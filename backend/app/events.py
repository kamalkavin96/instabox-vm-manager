"""In-process pub/sub that fans VM updates out to every connected browser (the /api/ws/events WebSocket)."""
import asyncio


class Hub:
    def __init__(self):
        self.subs: dict[asyncio.Queue, int] = {}       # queue -> vm id the subscriber wants full detail for (0 = none)

    @property
    def has_subscribers(self) -> bool:
        return bool(self.subs)

    def subscribe(self, detail_vm: int = 0) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        self.subs[q] = detail_vm
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self.subs.pop(q, None)

    def _put(self, q: asyncio.Queue, event: dict) -> None:
        if q.full():                                    # slow consumer: drop the oldest instead of blocking workers
            try:
                q.get_nowait()
            except asyncio.QueueEmpty:
                pass
        q.put_nowait(event)

    def publish(self, event: dict) -> None:
        for q in list(self.subs):
            self._put(q, event)

    def publish_vm(self, full: dict) -> None:
        """`full` includes the heavy `latest` snapshot; only subscribers viewing that VM receive it."""
        light = {k: v for k, v in full.items() if k != "latest"}
        for q, vid in list(self.subs.items()):
            self._put(q, {"type": "vm", "vm": full if vid == full["id"] else light})


hub = Hub()
