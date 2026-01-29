import requests
import json
import time

def test_chat():
    url = "http://localhost:8000/chat"
    payload = {
        "message": "Hello, how are you? My name is Test User.",
        "session_id": "test_session_python_robust"
    }

    print(f"--- Sending request to {url} ---")
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Response Data:")
            print(json.dumps(data, indent=2))
            
            # Check if history is working
            print("\n--- Testing Memory ---")
            payload_2 = {
                "message": "What is my name?",
                "session_id": "test_session_python_robust"
            }
            response_2 = requests.post(url, json=payload_2, timeout=10)
            if response_2.status_code == 200:
                print("Response 2 (Memory Test):")
                print(json.dumps(response_2.json(), indent=2))
            else:
                print(f"Memory test failed with status {response_2.status_code}")
        else:
            print(f"Error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to the FastAPI server. Is it running on port 8000?")
    except Exception as e:
        print(f"Unexpected Error: {e}")

if __name__ == "__main__":
    test_chat()
