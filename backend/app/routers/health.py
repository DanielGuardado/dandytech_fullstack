from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.db import get_db

router = APIRouter()

@router.get("")
def health():
    return {"ok": True}

@router.get("/db")
def health_db(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"db": "ok"}

@router.get("/db/version")
def sql_version(db: Session = Depends(get_db)):
    row = db.execute(text("SELECT @@VERSION AS v")).fetchone()
    return {"version": row.v if row else None}
