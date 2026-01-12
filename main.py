from starlette.middleware.sessions import SessionMiddleware
from fastapi import FastAPI, HTTPException, Request, APIRouter
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import Optional
from security.session_manager import SessionManager
from security.errros import AuthError, BadRequestError

from store import LRUCache
from persistence import append_log, recover_store, compact_log
from auth import register_user, login_user
import os
import httpx

ROLE = os.getenv("ROLE", "primary")  # primary | secondary
SECONDARY_URL = os.getenv("SECONDARY_URL", "http://127.0.0.1:8001")


LOG_FILE = "pykv.log"


# APP INITIALIZATION


app = FastAPI(title="PyKV Store")

# Serve static files (CSS, JS)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.add_middleware(
    SessionMiddleware,
    secret_key="super-secret-key-change-this",
    max_age=60 * 60 * 24
)



# HTML templates
templates = Jinja2Templates(directory="templates")

# IN-MEMORY STORE


kv_store = LRUCache(capacity=5)

# Recover persisted data on startup
recover_store(kv_store)

# DATA MODELS

class KeyValue(BaseModel):
    key: str
    value: str
    ttl: Optional[int] = None  # seconds

class RegisterRequest(BaseModel):
    email: str
    password: str
    remember_me: bool = False


# UI ROUTES (OPEN IN CHROME)


@app.get("/", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})


@app.get("/register-ui", response_class=HTMLResponse)
async def register_page(request: Request):
    return templates.TemplateResponse("register.html", {"request": request})


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    SessionManager.get_current_user(request)
    return templates.TemplateResponse("dashboard.html", {"request": request})

@app.get("/stats")
async def get_stats(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return kv_store.stats()
@app.get("/stats-ui", response_class=HTMLResponse)
async def stats_page(request: Request):
    SessionManager.get_current_user(request)
    return templates.TemplateResponse("stats.html", {"request": request})

@app.get("/api/stats")
async def get_stats():
    return kv_store.stats()

@app.get("/logout")
async def logout(request: Request):
    SessionManager.logout(request)
    return {"message": "Logged out successfully"}


# AUTHENTICATION APIs


@app.post("/register")
async def register(data: RegisterRequest):
    success, message = register_user(data.email, data.password)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {"message": message}


@app.post("/login")
async def login(data: RegisterRequest, request: Request):
    if not login_user(data.email, data.password):
        raise AuthError("Invalid credentials")

    SessionManager.login(
        request,
        email=data.email,
        remember_me=data.remember_me
    )

    return {"message": "Login successful"}


# KEY-VALUE STORE APIs

@app.post("/set")
async def set_key(data: KeyValue, request: Request):
    kv_store.set(data.key, data.value, data.ttl)
    append_log("SET", data.key, data.value, data.ttl)

    await replicate_to_secondary({
        "op": "SET",
        "key": data.key,
        "value": data.value,
        "ttl": data.ttl

    })

    return {"message": "Key set successfully"}



@app.get("/get/{key}")
async def get_key(key: str):
    value = kv_store.get(key)
    if value is None:
        raise HTTPException(status_code=404, detail="Key not found")
    return {"key": key, "value": value}


@app.delete("/delete/{key}")
async def delete_key(key: str):
    kv_store.delete(key)
    append_log("DELETE", key)

    await replicate_to_secondary({
        "op": "DELETE",
        "key": key
    })

    return {"message": "Key deleted successfully"}

@app.get("/keys")
async def list_keys():
    return {"keys": kv_store.keys()}

@app.get("/clear")
async def clear_cache():
    kv_store.clear()
    return {"message": "Cache cleared successfully"}

@app.post("/compact")
async def compact():
    compact_log(kv_store)
    return {"message": "Log compacted"}


async def replicate_to_secondary(entry: dict):
    if ROLE != "primary":
        return

    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{SECONDARY_URL}/replicate",
                json=entry,
                timeout=1
            )
    except Exception:
        # Secondary down → ignore (eventual consistency)
        pass

    return

@app.post("/replicate")
async def replicate(entry: dict):
    if entry["op"] == "SET":
        kv_store.set(entry["key"], entry["value"],entry.get("ttl"))
        append_log("SET", entry["key"], entry["value"])

    elif entry["op"] == "DELETE":
        kv_store.delete(entry["key"])
        append_log("DELETE", entry["key"])

    return {"status": "replicated"}

