let opsChart;
let cacheChart;
async function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const remember = document.getElementById("remember").checked;

    const res = await fetch("/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            email: email,
            password: password,
            remember_me: remember
        })
    });

    if (res.ok) {
        window.location.href = "/dashboard";
    } else {
        document.getElementById("msg").innerText = "Invalid credentials";
    }
}


async function register() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const res = await fetch("/register", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({email, password})
    });

    document.getElementById("msg").innerText =
        res.ok ? "Registered successfully" : "User exists";
}

async function setKey() {
    const key = document.getElementById("key").value;
    const value = document.getElementById("value").value;

    const res = await fetch("/set", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ key, value })
    });

    if (res.ok) {
        showToast("Key SET successfully ✅");
    } else {
        showToast("Failed to SET key ❌", false);
    }
}


async function getKey() {
    const key = document.getElementById("key").value;

    const res = await fetch(`/get/${key}`);

    if (res.ok) {
        const data = await res.json();
        document.getElementById("value").value = data.value;
        showToast("Key GET successfully ✅");
    } else {
        showToast("Key not found ❌", false);
    }
}


async function deleteKey() {
    const key = document.getElementById("key").value;

    const res = await fetch(`/delete/${key}`, {
        method: "DELETE"
    });

    if (res.ok) {
        showToast("Key DELETE successfully ✅");
    } else {
        showToast("Failed to DELETE key ❌", false);
    }
}

function togglePassword(id) {
    const input = document.getElementById(id);
    input.type = input.type === "password" ? "text" : "password";
}
function showToast(message, success = true) {
    const toast = document.getElementById("toast");
    toast.innerText = message;
    toast.style.background = success ? "#16a34a" : "#dc2626";

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

async function logout() {
    await fetch("/logout");
    showToast("Logged out successfully 👋");
    setTimeout(() => {
        window.location.href = "/";
    }, 800);
}
async function loadStats() {
    const res = await fetch("/stats");
    const data = await res.json();

    document.getElementById("total_keys").innerText = data.total_keys;
    document.getElementById("capacity").innerText = data.capacity;
    document.getElementById("hits").innerText = data.hits;
    document.getElementById("misses").innerText = data.misses;
    document.getElementById("set_ops").innerText = data.set_ops;
    document.getElementById("get_ops").innerText = data.get_ops;
    document.getElementById("delete_ops").innerText = data.delete_ops;
}


async function loadCharts() {
    const res = await fetch("/stats");
    const data = await res.json();

    // -------- OPERATIONS BAR CHART --------
    const opsCtx = document.getElementById("opsChart").getContext("2d");

    if (opsChart) opsChart.destroy();

    opsChart = new Chart(opsCtx, {
        type: "bar",
        data: {
            labels: ["SET", "GET", "DELETE"],
            datasets: [{
                label: "Operations Count",
                data: [data.set_ops, data.get_ops, data.delete_ops],
                backgroundColor: ["#2563eb", "#16a34a", "#dc2626"]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            }
        }
    });

    // -------- CACHE DOUGHNUT CHART --------
    const cacheCtx = document.getElementById("cacheChart").getContext("2d");

    if (cacheChart) cacheChart.destroy();

    cacheChart = new Chart(cacheCtx, {
        type: "doughnut",
        data: {
            labels: ["Hits", "Misses"],
            datasets: [{
                data: [data.hits, data.misses],
                backgroundColor: ["#22c55e", "#f97316"]
            }]
        },
        options: {
            responsive: true
        }
    });
}

async function openStatModal(type) {
    const res = await fetch("/stats");
    const data = await res.json();

    let title = "";
    let content = "";

    switch (type) {
        case "total_keys":
            title = "Total Keys";
            content = `
                Total keys currently stored: ${data.total_keys}
                \n\nThis represents the number of active key-value pairs
                present in memory right now.
            `;
            break;

        case "capacity":
            title = "Cache Capacity";
            content = `
                Cache capacity: ${data.capacity}
                \n\nThis is the maximum number of keys the cache can hold.
                When exceeded, LRU eviction occurs.
            `;
            break;

        case "hits":
            title = "Cache Hits";
            content = `
                Cache hits: ${data.hits}
                \n\nNumber of successful GET operations where
                the key was found in memory.
            `;
            break;

        case "misses":
            title = "Cache Misses";
            content = `
                Cache misses: ${data.misses}
                \n\nNumber of GET operations where
                the key was NOT found.
            `;
            break;

        case "set_ops":
            title = "SET Operations";
            content = `
                Total SET operations: ${data.set_ops}
                \n\nCounts how many times new or existing
                keys were written.
            `;
            break;

        case "get_ops":
            title = "GET Operations";
            content = `
                Total GET operations: ${data.get_ops}
                \n\nCounts all read requests (hits + misses).
            `;
            break;

        case "delete_ops":
            title = "DELETE Operations";
            content = `
                Total DELETE operations: ${data.delete_ops}
                \n\nCounts how many keys were removed
                from the cache.
            `;
            break;
    }

    document.getElementById("modalTitle").innerText = title;
    document.getElementById("modalContent").innerText = content;

    document.getElementById("modalOverlay").classList.add("show");
    document.getElementById("statModal").classList.add("show");
}

function closeModal() {
    document.getElementById("modalOverlay").classList.remove("show");
    document.getElementById("statModal").classList.remove("show");
}
function loadCharts() {
    const opsCtx = document.getElementById("opsChart").getContext("2d");
    const cacheCtx = document.getElementById("cacheChart").getContext("2d");

    opsChart = new Chart(opsCtx, {
        type: "bar",
        data: {
            labels: ["SET", "GET", "DELETE"],
            datasets: [{
                label: "Operations",
                data: [0, 0, 0],
                backgroundColor: ["#6366f1", "#22c55e", "#ef4444"]
            }]
        },
        options: {
            responsive: true,
            animation: false
        }
    });

    cacheChart = new Chart(cacheCtx, {
        type: "doughnut",
        data: {
            labels: ["Hits", "Misses"],
            datasets: [{
                data: [0, 0],
                backgroundColor: ["#22c55e", "#f97316"]
            }]
        },
        options: {
            responsive: true,
            animation: false
        }
    });

    startRealtimeStats();
}
function startRealtimeStats() {
    setInterval(fetchStats, 2000); // every 2 seconds
}

async function fetchStats() {
    const res = await fetch("/api/stats");
    const data = await res.json();

    // Update numbers
    document.getElementById("total_keys").innerText = data.total_keys;
    document.getElementById("capacity").innerText = data.capacity;
    document.getElementById("hits").innerText = data.hits;
    document.getElementById("misses").innerText = data.misses;
    document.getElementById("set_ops").innerText = data.set;
    document.getElementById("get_ops").innerText = data.get;
    document.getElementById("delete_ops").innerText = data.delete;

    // Update charts
    opsChart.data.datasets[0].data = [
        data.set,
        data.get,
        data.delete
    ];
    opsChart.update();

    cacheChart.data.datasets[0].data = [
        data.hits,
        data.misses
    ];
    cacheChart.update();
}
