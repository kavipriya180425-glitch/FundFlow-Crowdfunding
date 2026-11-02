
from flask import (
    Flask, request, jsonify, send_from_directory,
    redirect, session
)
import sqlite3
import secrets
from pathlib import Path
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)

# Secret key for local demo sessions
app.secret_key = secrets.token_hex(32)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

BASE_DIR = Path(__file__).resolve().parent
DB_NAME = BASE_DIR / "fundflow.db"


# Database connection
def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


# Login protection for POST APIs
def login_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Please login first"}), 401
        return function(*args, **kwargs)
    return wrapper


# Create database tables
def create_database():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            goal INTEGER NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS donations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            donor_name TEXT NOT NULL,
            amount INTEGER NOT NULL,
            campaign_id INTEGER NOT NULL,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
        )
    """)

    # New users table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL
        )
    """)

    count = conn.execute(
        "SELECT COUNT(*) FROM campaigns"
    ).fetchone()[0]

    if count == 0:
        conn.executemany("""
            INSERT INTO campaigns (title, description, goal)
            VALUES (?, ?, ?)
        """, [
            ("Education for Children",
             "Help children continue their education.", 10000),
            ("Medical Support",
             "Support people who need medical assistance.", 20000),
            ("Food for Everyone",
             "Provide food for needy families.", 15000)
        ])

    conn.commit()
    conn.close()


# Login page
@app.route("/login")
def login_page():
    if "user_id" in session:
        return redirect("/")
    return send_from_directory(BASE_DIR, "auth.html")


# Home page
@app.route("/")
def home():
    if "user_id" not in session:
        return redirect("/login")
    return send_from_directory(BASE_DIR, "index.html")


# CSS and JavaScript files
@app.route("/style.css")
def css():
    return send_from_directory(BASE_DIR, "style.css")


@app.route("/script.js")
def javascript():
    return send_from_directory(BASE_DIR, "script.js")


@app.route("/auth.css")
def auth_css():
    return send_from_directory(BASE_DIR, "auth.css")


@app.route("/auth.js")
def auth_javascript():
    return send_from_directory(BASE_DIR, "auth.js")


# Register a new user
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    password = data.get("password", "")

    if not name or len(name) < 2:
        return jsonify({"error": "Enter a valid name"}), 400

    if not email or "@" not in email or len(email) > 254:
        return jsonify({"error": "Enter a valid email address"}), 400

    if not isinstance(password, str) or len(password) < 8:
        return jsonify({
            "error": "Password must contain at least 8 characters"
        }), 400

    password_hash = generate_password_hash(password)

    conn = get_db()

    try:
        conn.execute("""
            INSERT INTO users (name, email, password_hash)
            VALUES (?, ?, ?)
        """, (name, email, password_hash))

        conn.commit()

    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Email already registered"}), 409

    conn.close()

    return jsonify({
        "message": "Account created successfully. Please login."
    }), 201


# Login an existing user
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = str(data.get("email", "")).strip().lower()
    password = data.get("password", "")

    if not email or not isinstance(password, str) or not password:
        return jsonify({"error": "Email and password are required"}), 400

    conn = get_db()

    user = conn.execute("""
        SELECT id, name, email, password_hash
        FROM users
        WHERE email = ?
    """, (email,)).fetchone()

    conn.close()

    if user is None or not check_password_hash(
        user["password_hash"], password
    ):
        return jsonify({"error": "Invalid email or password"}), 401

    session.clear()
    session["user_id"] = user["id"]
    session["user_name"] = user["name"]

    return jsonify({
        "message": "Login successful",
        "name": user["name"]
    })


# Logout
@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully"})


# Get all campaigns
@app.route("/api/campaigns", methods=["GET"])
def get_campaigns():
    conn = get_db()

    rows = conn.execute("""
        SELECT c.id, c.title, c.description, c.goal,
        COALESCE(SUM(d.amount), 0) AS raised
        FROM campaigns c
        LEFT JOIN donations d ON c.id = d.campaign_id
        GROUP BY c.id
        ORDER BY c.id DESC
    """).fetchall()

    campaigns = [dict(row) for row in rows]
    conn.close()

    return jsonify(campaigns)


# Create a campaign
@app.route("/api/campaigns", methods=["POST"])
@login_required
def create_campaign():
    data = request.get_json(silent=True) or {}

    title = str(data.get("title", "")).strip()
    description = str(data.get("description", "")).strip()
    goal = data.get("goal")

    if not title or not description:
        return jsonify({
            "error": "Title and description are required"
        }), 400

    if isinstance(goal, bool) or not isinstance(goal, int) or goal <= 0:
        return jsonify({"error": "Enter a valid target amount"}), 400

    conn = get_db()

    cursor = conn.execute("""
        INSERT INTO campaigns (title, description, goal)
        VALUES (?, ?, ?)
    """, (title, description, goal))

    conn.commit()
    campaign_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "message": "Campaign created successfully",
        "id": campaign_id
    }), 201


# Get all donations / donor list
@app.route("/api/donations", methods=["GET"])
def get_donations():
    conn = get_db()

    rows = conn.execute("""
        SELECT d.id, d.donor_name, d.amount,
               c.title AS campaign
        FROM donations d
        JOIN campaigns c ON d.campaign_id = c.id
        ORDER BY d.id DESC
    """).fetchall()

    donations = [dict(row) for row in rows]
    conn.close()

    return jsonify(donations)


# Submit a donation
@app.route("/api/donations", methods=["POST"])
@login_required
def create_donation():
    data = request.get_json(silent=True) or {}

    name = str(data.get("donor_name", "")).strip()
    amount = data.get("amount")
    campaign_id = data.get("campaign_id")

    if not name:
        return jsonify({"error": "Donor name is required"}), 400

    if isinstance(amount, bool) or not isinstance(amount, int) or amount <= 0:
        return jsonify({"error": "Enter a valid donation amount"}), 400

    if isinstance(campaign_id, bool) or not isinstance(campaign_id, int) or campaign_id <= 0:
        return jsonify({"error": "Select a valid campaign"}), 400

    conn = get_db()

    campaign = conn.execute(
        "SELECT id FROM campaigns WHERE id = ?",
        (campaign_id,)
    ).fetchone()

    if campaign is None:
        conn.close()
        return jsonify({"error": "Campaign not found"}), 404

    conn.execute("""
        INSERT INTO donations (donor_name, amount, campaign_id)
        VALUES (?, ?, ?)
    """, (name, amount, campaign_id))

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Donation recorded successfully"
    }), 201


if __name__ == "__main__":
    create_database()
    app.run(debug=True)
