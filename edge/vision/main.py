import time
import cv2
import requests

from pydantic_settings import BaseSettings
from ultralytics import solutions


PEOPLE_CLASS = 0
WEBCAM_VIDEO_PATH = 0
DEBOUNCE_TIME_SECONDS = 0.5


class Settings(BaseSettings):
    property: int
    node: int
    base_url: str


class HTTPEventBus:
    property: int
    node: int
    base_url: str

    def __init__(self, property: int, node: int, base_url: str):
        self.property = property
        self.node = node
        self.base_url = base_url

    def publish(self, event: str):
        data = {"property_id": self.property, "room": self.node, "event": event}
        response = requests.post(self.base_url + "/api/v1/edge/vision/event", json=data)
        if response.status_code != 204:
            print(f"Failed to publish event: {response.status_code} - {response.text}")


def count_specific_classes(video_path, model_path, event_bus):
    """Count people in a video."""
    cap = cv2.VideoCapture(video_path)
    assert cap.isOpened(), "Error reading video file"

    line_points = [(20, 400), (1080, 400)]
    counter = solutions.ObjectCounter(show=True, region=line_points, model=model_path, classes=[PEOPLE_CLASS])

    last_count = 0
    event_debounce_start = 0

    while cap.isOpened():
        success, im0 = cap.read()
        if not success:
            print("Video frame is empty or processing is complete.")
            break
        _ = counter(im0)
        people_count = len(counter.boxes)
        if people_count != last_count:
            if event_debounce_start == 0:
                event_debounce_start = time.time()
            if time.time() - event_debounce_start >= DEBOUNCE_TIME_SECONDS:
                event_debounce_start = 0
                for _ in range(abs(people_count - last_count)):
                    event_bus.publish("in" if people_count > last_count else "out")
                last_count = people_count
        else:
            event_debounce_start = 0

    cap.release()
    cv2.destroyAllWindows()


settings = Settings()
http_event_bus = HTTPEventBus(settings.property, settings.node, settings.base_url)
count_specific_classes(WEBCAM_VIDEO_PATH, "yolo26n.pt", http_event_bus)
