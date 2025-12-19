import socket
import asyncio
import random
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
import base64
import os
from dotenv import load_dotenv

load_dotenv()

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

@app.post("/scan-food")
async def scan_food(file: UploadFile = File(...)):
    print(f"📸 Image received! Filename: {file.filename}")
    
    contents = await file.read()
    encoded_image = base64.b64encode(contents).decode('utf-8')
    print(f"📦 File size: {len(contents)} bytes")

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
                                                    "url": f"data:image/jpeg;base64,{encoded_image}",
                                                },
                                            },
                                        ],
                                    }
                                ],
                                model="meta-llama/llama-4-scout-17b-16e-instruct",
                                stream=True
                            )

        for chunk in chat_completion:
            content =  chunk.choices[0].delta.content

            if content:
                clean_content = content.replace("\n", "\\n")
                
                yield f"data: {clean_content}\n\n" # Necessary SSE Format
            
        yield "data: [DONE]\n\n"

    return StreamingResponse(recipe_generator(encoded_image), media_type="text/event-stream")

@app.get("/")
def read_root():
    return {"message": "Backend is running!", "ip": get_local_ip()}

if __name__ == "__main__":
    import uvicorn
    local_ip = get_local_ip()
    print(f"\nBACKEND RUNNING AT: http://{local_ip}:8000")
    print(f"URL FOR APP: http://{local_ip}:8000\n")
    
    # Listen on 0.0.0.0 to allow access from external devices (your phone)
    uvicorn.run(app, host="0.0.0.0", port=8000)