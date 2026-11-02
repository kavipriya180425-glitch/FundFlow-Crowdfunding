
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

// Switch to Login
loginTab.addEventListener("click", function() {
    loginForm.hidden = false;
    registerForm.hidden = true;
    loginTab.classList.add("active");
    registerTab.classList.remove("active");
});

// Switch to Register
registerTab.addEventListener("click", function() {
    loginForm.hidden = true;
    registerForm.hidden = false;
    registerTab.classList.add("active");
    loginTab.classList.remove("active");
});

// Registration
registerForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const message = document.getElementById("registerMessage");

    if (password !== confirmPassword) {
        message.style.color = "red";
        message.textContent = "Passwords do not match.";
        return;
    }

    message.style.color = "blue";
    message.textContent = "Creating account...";

    try {
        const response = await fetch("/api/register", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({name, email, password})
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Registration failed");
        }

        message.style.color = "green";
        message.textContent = result.message;

        registerForm.reset();

        setTimeout(function() {
            loginTab.click();
            document.getElementById("loginEmail").value = email;
        }, 1200);

    } catch (error) {
        message.style.color = "red";
        message.textContent = error.message;
    }
});

// Login
loginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const message = document.getElementById("loginMessage");

    message.style.color = "blue";
    message.textContent = "Checking login...";

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({email, password})
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Login failed");
        }

        message.style.color = "green";
        message.textContent = "Login successful!";

        window.location.href = "/";

    } catch (error) {
        message.style.color = "red";
        message.textContent = error.message;
    }
});
