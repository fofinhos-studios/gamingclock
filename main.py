# -*- coding: utf-8 -*-
import json

from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from howlongtobeatpy import HowLongToBeat
from rich import print

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5555"
    ],
    allow_credentials=True,
    allow_methods=["*"]
)


@app.post("/")
async def root(request: Request):
    query = await request.body()
    query = query.decode("utf-8")
    print(f"Query: {query}")
    result = howlongtobeat(query)
    result = jsonable_encoder(result)
    print(result)
    print("Finished, returning...")
    return JSONResponse(content=jsonable_encoder(result))


def howlongtobeat(query):
    print("Requesting HowLongToBeat data...")
    results = HowLongToBeat(0.2).search(query, similarity_case_sensitive=False)
    result = results[0]

    name = result.game_name
    image_url = "https://www.howlongtobeat.com" + result.game_image_url
    duration = float((result.gameplay_main).replace("½", ".5"))
    unit = result.gameplay_main_unit

    game = {"name": name, "image_url": image_url,
            "duration": duration, "unit": unit}
    
    with open("game.json", "w") as fp:
        json.dump(game, fp, indent=4)    

    return(game)
