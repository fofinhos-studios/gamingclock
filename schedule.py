import datetime
import json

with open("game.json", "r") as fp:
    game = json.load(fp)

print("Generating schedule...")

daily_hours = datetime.timedelta(hours=2, minutes=00)
current_duration = datetime.timedelta(hours=0)

days = []
daily_items = []
current_day = 1

# lessons = []
# for section in content:
#     lessons.extend(section["items"])

duration = datetime.timedelta(hours=game["duration"])
while(duration >= datetime.timedelta(0)):
    day = {
        "day": current_day,
        "items": daily_items,
        "duration": daily_hours,
    }
    days.append(day)
    current_day += 1
    duration -= daily_hours
    daily_items = [game]
    print(f"Day: {day} Duration: {duration}")
else:
    daily_items.append(game)

print(days)
