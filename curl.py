import requests
from rich import print
import os
import json

os.environ["NO_PROXY"] = "127.0.0.1"
query = input()

url = "http://127.0.0.1:8000"

print("Requesting data...")
response = requests.get(url=url, data=f"{query}")
print(response.status_code)
print(json.loads(response.text))
