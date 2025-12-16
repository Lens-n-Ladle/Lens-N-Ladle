import socket
from fastapi import FastAPI

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