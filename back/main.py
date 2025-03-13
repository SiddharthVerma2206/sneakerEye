from fastapi import FastAPI, Query #type:ignore
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client #type:ignore
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# Supabase credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5500"],  # Allow specific origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api")
def home():
    return {"message": "Sneaker API is running"}

@app.get("/sites")
def get_sites():
    """Get all unique site names for filtering"""
    response = supabase.table("sneaker_data").select("site").execute()
    # Extract unique site values
    sites = set(item.get('site', '') for item in response.data if item.get('site'))
    return {"sites": sorted(list(sites))}

@app.get("/brand")
def get_brands(brand : str = Query()):
    query = supabase.table("sneaker_data").select("*")
    if brand:
        query = query.ilike("brand", f"%{brand}%")
    response = query.execute()
    data = response.data
    return data

@app.get("/sneakers")
def get_sneakers(
    search: str = Query(None),
    sort: str = Query("price-low-high"),
    site: str = Query("all"),
    currency: str = Query("original")
):  
    query = supabase.table("sneaker_data").select("*")
    
    # If a search term is provided, filter results
    if search:
        query = query.ilike("title", f"%{search}%")  # Case-insensitive search
    
    # Note: We're retrieving all sites and letting the client-side filter them
    # This is more efficient for multi-select filtering
    
    response = query.execute()
    data = response.data
    
    # Apply sorting (client-side since Supabase has limitations with variant-based sorting)
    if sort == "price-low-high":
        # Sort by the lowest price variant
        data.sort(key=lambda x: min([v.get('price', float('inf')) for v in x.get('variants', [])]))
    elif sort == "price-high-low":
        # Sort by the highest price variant
        data.sort(key=lambda x: max([v.get('price', 0) for v in x.get('variants', [])]), reverse=True)
    elif sort == "discount":
        # Sort by the highest discount percentage
        def get_max_discount(sneaker):
            discounts = []
            for v in sneaker.get('variants', []):
                if v.get('full_price') and v.get('price'):
                    discount = (1 - v.get('price') / v.get('full_price')) * 100
                    discounts.append(discount)
            return max(discounts) if discounts else 0
            
        data.sort(key=get_max_discount, reverse=True)
    elif sort == "newest":
        # Sort by created_at timestamp if available, otherwise keep original order
        data.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    return data