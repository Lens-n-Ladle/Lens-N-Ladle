import socket
import asyncio
import random
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import StreamingResponse

app = FastAPI()

def get_local_ip():
    """Utility to find the computer's LAN IP address."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # This doesn't actually connect to anything, just finds the route
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
    
    # 1. Simulate reading the file (to prove upload works)
    contents = await file.read()
    print(f"📦 File size: {len(contents)} bytes")

    # 2. The Mock Streaming Logic
    async def fake_recipe_generator():
        # A list of random fake recipes to choose from
        recipes = [
            "Start by chopping the onions.\nSauté them until golden brown.\nAdd garlic and ginger.",
            "Mix flour and sugar in a bowl.\nAdd two eggs and whisk vigorously.\nBake at 180°C.",
            "This looks like a delicious Pizza!\n1. Prepare the dough.\n2. Add tomato sauce.\n3. Add mozzarella."
        ]
        
        selected_recipe = random.choice(recipes)
        words = selected_recipe.split(" ") # Split into words to simulate typing

        # Simulate "AI Thinking" delay
        yield f"data: ...Analyzing image...\n\n"
        await asyncio.sleep(1.0) 

        # Simulate "Typing"
        for word in words:
            # Send word + space
            yield f"data: {word} \n\n" 
            # Random delay between words (0.05s to 0.3s) to feel human
            await asyncio.sleep(random.uniform(0.05, 0.3))
        
        # Signal completion
        yield "data: [DONE]\n\n"

    # 3. Return the stream
    return StreamingResponse(fake_recipe_generator(), media_type="text/event-stream")

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