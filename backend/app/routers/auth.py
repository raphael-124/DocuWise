from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.models.schemas import UserCreate, UserLogin, Token, User
from app.services.auth_service import auth_service
from app.services.db import db
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)
router = APIRouter(tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = auth_service.decode_token(token)
    if payload is None:
        raise credentials_exception
    
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
    
    user = db.get_user_by_email(email)
    if user is None:
        raise credentials_exception
    
    return user

@router.post("/register", response_model=User)
async def register(user_in: UserCreate):
    existing_user = db.get_user_by_email(user_in.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = auth_service.get_password_hash(user_in.password)
    success = db.create_user(user_in.email, hashed_pw)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create user")
    
    new_user = db.get_user_by_email(user_in.email)
    return {"id": new_user["id"], "email": new_user["email"]}

@router.post("/login", response_model=Token)
async def login(user_in: UserLogin):
    user = db.get_user_by_email(user_in.email)
    if not user or not auth_service.verify_password(user_in.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth_service.create_access_token(data={"sub": user["email"]})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=User)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {"id": current_user["id"], "email": current_user["email"]}

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

@router.post("/change-password")
async def change_password(
    data: PasswordChange,
    current_user: dict = Depends(get_current_user)
):
    if not auth_service.verify_password(data.current_password, current_user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    hashed_pw = auth_service.get_password_hash(data.new_password)
    db.update_password(current_user["id"], hashed_pw)
    return {"message": "Password updated successfully"}

@router.delete("/account")
async def delete_account(
    current_user: dict = Depends(get_current_user)
):
    from app.services.llm_service import llm_service
    # 1. Clean up documents and messages via llm_service
    llm_service.delete_all_documents(current_user["id"])
    
    # 2. Delete user from DB
    success = db.delete_user(current_user["id"])
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete account")
    
    return {"message": "Account and all associated data deleted successfully"}
