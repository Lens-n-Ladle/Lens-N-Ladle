import socket
import asyncio
import random
from typing import Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Header, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from supabase import create_client, Client
import base64
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = "https://mvpllsytaattjvtejfpy.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12cGxsc3l0YWF0dGp2dGVqZnB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTg1NzQsImV4cCI6MjA4Mzg5NDU3NH0.IlrGNAGiaOazWBXo4G2MiUtRSKNgUdeJ2J2adm9Cfi8"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins (phone, web, etc.)
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)
def get_local_ip():
    """Utility to find the computer's LAN IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

class ImageRequest(BaseModel):
    image: str

# This function checks the header for "Authorization: Bearer <token>"
async def verify_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        # NOTE: For now, we raise 401. If you want to allow guests, delete this line.
        raise HTTPException(status_code=401, detail="Missing Authorization Header")
    
    token = authorization.replace("Bearer ", "")
    try:
        # Ask Supabase: "Is this token valid?"
        user_response = supabase.auth.get_user(token)
        return user_response.user
    except Exception as e:
        print(f"Auth Error: {e}")
        raise HTTPException(status_code=401, detail="Invalid Token")

@app.post("/scan-food")
async def scan_food(request: ImageRequest):
    # We no longer need to read() or b64encode() because 
    # the frontend is sending it already encoded!
    encoded_image = request.image.strip()
    
    # 2. Check if the frontend already sent the header
    if encoded_image.startswith("data:image"):
        # If it already has the header, use it as is
        final_image_url = encoded_image
    else:
        # If it's raw base64, add the header manually
        final_image_url = f"data:image/jpeg;base64,{encoded_image}" 
    
    print(f"📸 Image received! Length: {len(final_image_url[:30])}")

    async def recipe_generator(encoded_image):
        yield ": ping\n\n" 

        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Tell me the recipe for this image?"},
                        {
                            "type": "image_url",
                            "image_url": {
                                # The base64 string needs the header prefix for the LLM
                                "url": f"{encoded_image}",
                            },
                        },
                    ],
                }
            ],
            model="meta-llama/llama-4-maverick-17b-128e-instruct", # Use a Vision model
            stream=True
        )

        for chunk in chat_completion:
            content = chunk.choices[0].delta.content
            if content:
                clean_content = content.replace("\n", "\\n")
                yield f"data: {clean_content}\n\n"
            
        yield "data: [DONE]\n\n"

    return StreamingResponse(recipe_generator(final_image_url), media_type="text/event-stream")

@app.get("/")
def read_root():
    return {"message": "Backend is running!", "ip": get_local_ip()}

if __name__ == "__main__":
    import uvicorn
    local_ip = get_local_ip()
    port = 8082
    print(f"\nBACKEND RUNNING AT: http://{local_ip}:{port}")
    print(f"URL FOR APP: http://{local_ip}:{port}\n")
    
    # Listen on 0.0.0.0 to allow access from external devices (your phone)
    uvicorn.run(app, host="0.0.0.0", port=port)