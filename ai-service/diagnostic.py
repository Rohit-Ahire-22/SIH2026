import time
import os
import psutil
import requests
import cv2
import threading
from app.services.ocr_service import get_ocr, run_ocr

def measure_direct():
    print("--- DIRECT PYTHON MEASUREMENTS ---")
    
    # 1. Startup & Init
    process = psutil.Process(os.getpid())
    mem_before = process.memory_info().rss / (1024 * 1024)
    print(f"Memory before model init: {mem_before:.2f} MB")
    
    t0 = time.time()
    ocr = get_ocr()
    t1 = time.time()
    mem_after = process.memory_info().rss / (1024 * 1024)
    print(f"Model init time: {t1 - t0:.2f} s")
    print(f"Memory after model init: {mem_after:.2f} MB")
    
    # Load 1 proprietary image
    image_path = "../dataset/raw/proprietary/product_001/back.jpeg"
    with open(image_path, "rb") as f:
        image_bytes = f.read()

    # Cold inference
    print("\nRunning cold inference...")
    t2 = time.time()
    res1 = run_ocr(image_bytes)
    t3 = time.time()
    mem_after_cold = process.memory_info().rss / (1024 * 1024)
    print(f"Cold inference time: {t3 - t2:.2f} s")
    print(f"Memory after cold inference: {mem_after_cold:.2f} MB")

    # Warm inference 1
    print("\nRunning warm inference 1...")
    t4 = time.time()
    res2 = run_ocr(image_bytes)
    t5 = time.time()
    print(f"Warm inference 1 time: {t5 - t4:.2f} s")

    # Warm inference 2
    print("\nRunning warm inference 2...")
    t6 = time.time()
    res3 = run_ocr(image_bytes)
    t7 = time.time()
    print(f"Warm inference 2 time: {t7 - t6:.2f} s")

def check_health(fastapi_url):
    try:
        t0 = time.time()
        r = requests.get(f"{fastapi_url}/health", timeout=2)
        t1 = time.time()
        print(f"  Health check response: {r.status_code} in {t1-t0:.2f}s")
    except Exception as e:
        print(f"  Health check failed: {e}")

def measure_fastapi():
    print("\n--- FASTAPI MEASUREMENTS ---")
    fastapi_url = "http://127.0.0.1:8001"
    image_path = "../dataset/raw/proprietary/product_001/back.jpeg"
    
    print("Checking initial health...")
    check_health(fastapi_url)
    
    print("\nSending OCR request...")
    with open(image_path, "rb") as f:
        files = {"image": ("back.jpeg", f, "image/jpeg")}
        data = {"variant": "original"}
        
        # Start background health checks
        def health_loop():
            for _ in range(5):
                time.sleep(1)
                print("Checking health during OCR...")
                check_health(fastapi_url)
                
        t = threading.Thread(target=health_loop)
        t.start()
        
        t0 = time.time()
        try:
            r = requests.post(f"{fastapi_url}/ocr", files=files, data=data, timeout=120)
            t1 = time.time()
            print(f"FastAPI OCR request time: {t1 - t0:.2f} s (Status: {r.status_code})")
        except Exception as e:
            print(f"FastAPI OCR request failed: {e}")
        
        t.join()

if __name__ == "__main__":
    measure_direct()
    measure_fastapi()
