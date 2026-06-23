from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import engine, Base, get_db
from app.models.item import Item
from app.schemas.item import Item as ItemSchema, ItemCreate
from app.crud.item import get_items, create_item

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="FastAPI + MySQL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:56114"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "FastAPI + MySQL is running!"}

@app.get("/api/items", response_model=list[ItemSchema])
def read_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return get_items(db, skip=skip, limit=limit)

@app.post("/api/items", response_model=ItemSchema)
def create_new_item(item: ItemCreate, db: Session = Depends(get_db)):
    return create_item(db=db, item=item)