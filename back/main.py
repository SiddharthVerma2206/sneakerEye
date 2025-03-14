from fastapi import FastAPI, Query #type:ignore
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client #type:ignore
import os
from typing import Optional
from dotenv import load_dotenv
import requests

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


def get_inr_to_usd_rate():
    url = "https://api.exchangerate-api.com/v4/latest/INR"
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an error for bad response
        data = response.json()
        inr_to_usd = data["rates"]["USD"]  # Get INR to USD rate
        return inr_to_usd
    except requests.exceptions.RequestException as e:
        print(f"Error fetching exchange rate: {e}")
        return 1/83.5  # Fallback rate (approximate)
# Currency conversion rate
INR_TO_USD = get_inr_to_usd_rate()  # Approximate conversion rate (1 INR = 0.012 USD)

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
):  
    query = supabase.table("sneaker_data").select("*")
    
    # If a search term is provided, filter results
    if search:
        query = query.ilike("title", f"%{search}%")  # Case-insensitive search
    
    # Note: We're retrieving all sites and letting the client-side filter them
    # This is more efficient for multi-select filtering
    
    response = query.execute()
    data = response.data
    
    # Normalize prices for consistent sorting (all converted to USD equivalents)
    for sneaker in data:
        for variant in sneaker.get('variants', []):
            # Assume price > 2000 is INR, otherwise USD
            if variant.get('price', 0) > 2000:
                # Store the original price
                variant['original_price'] = variant.get('price')
                # Add a normalized price in USD for sorting
                variant['normalized_price'] = variant.get('price') * INR_TO_USD
                
                # Also normalize full_price if it exists
                if variant.get('full_price'):
                    variant['original_full_price'] = variant.get('full_price')
                    variant['normalized_full_price'] = variant.get('full_price') * INR_TO_USD
            else:
                # Already in USD
                variant['original_price'] = variant.get('price')
                variant['normalized_price'] = variant.get('price')
                
                if variant.get('full_price'):
                    variant['original_full_price'] = variant.get('full_price')
                    variant['normalized_full_price'] = variant.get('full_price')
    
    # Apply sorting (client-side since Supabase has limitations with variant-based sorting)
    if sort == "price-low-high":
        # Sort by the lowest normalized price variant
        data.sort(key=lambda x: min([v.get('normalized_price', float('inf')) for v in x.get('variants', [])]))
    elif sort == "price-high-low":
        # Sort by the highest normalized price variant
        data.sort(key=lambda x: max([v.get('normalized_price', 0) for v in x.get('variants', [])]), reverse=True)
    elif sort == "discount":
        # Sort by the highest discount percentage (using normalized prices)
        def get_max_discount(sneaker):
            discounts = []
            for v in sneaker.get('variants', []):
                if v.get('normalized_full_price') and v.get('normalized_price'):
                    discount = (1 - v.get('normalized_price') / v.get('normalized_full_price')) * 100
                    discounts.append(discount)
            return max(discounts) if discounts else 0
            
        data.sort(key=get_max_discount, reverse=True)
    elif sort == "newest":
        # Sort by created_at timestamp if available, otherwise keep original order
        data.sort(key=lambda x: x.get('created_at', ''), reverse=True)
    
    # Remove the normalized prices before returning to client
    # to avoid confusion and keep the response clean
    for sneaker in data:
        for variant in sneaker.get('variants', []):
            # Restore original prices
            if 'original_price' in variant:
                variant['price'] = variant['original_price']
                del variant['original_price']
                del variant['normalized_price']
            
            if 'original_full_price' in variant:
                variant['full_price'] = variant['original_full_price']
                del variant['original_full_price']
                del variant['normalized_full_price']
    
    return data