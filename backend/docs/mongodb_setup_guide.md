# MongoDB Atlas Setup Guide

How to get your own MongoDB connection working for local development on
this project. Follow this once per machine.

## 1. Get access to the cluster

Ask a team member with Atlas project access to either:
- Send you the connection string directly (private message only — never
  paste it in a group chat or commit it), or
- Add you as a project member in Atlas (Project → Access Manager → Add
  Member), so you can generate your own connection string

## 2. Create your `.env` file

In `backend/`, copy the template:
```powershell
copy backend\.env.example backend\.env
```

Open `backend/.env` and fill in the real values:
```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=cardioxai
JWT_SECRET=<any long random string for local dev>
```

**Never commit this file.** It's already covered by `.gitignore` — if
`git status` ever shows `backend/.env` as a tracked or staged change,
stop and ask before committing.

## 3. Install dependencies and test the connection

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

If it starts without a `MONGODB_URI is missing` or `ServerSelectionTimeoutError`,
your connection is working.

## 4. Common connection errors

| Error | Likely cause | Fix |
|---|---|---|
| `MONGODB_URI is missing` | `.env` file not created, or in the wrong folder | Must be `backend/.env`, not the project root |
| `ServerSelectionTimeoutError` / SSL handshake failed | Your IP isn't in Atlas's allow-list | Atlas dashboard → Network Access → Add your current IP (or "Allow Access from Anywhere" for dev) |
| `Authentication failed` | Wrong username/password in the URI | Re-check the string, especially special characters in the password |

## 5. Verify everything is set up correctly

```powershell
python check_db_health.py
```
This checks the connection, confirms all expected indexes exist, and
prints how many documents are in each collection.
