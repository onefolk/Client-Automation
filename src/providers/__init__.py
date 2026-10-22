"""Replaceable providers; external implementations require a measured promotion gate."""
from typing import Protocol, Any

class DiscoveryProvider(Protocol):
    name: str
    def discover(self) -> tuple[list[dict[str, Any]], list[str]]: ...

class ResearchProvider(Protocol):
    name: str
    def investigate(self, candidate: dict[str, Any]) -> dict[str, Any] | None: ...

class VerificationProvider(Protocol):
    name: str
    def verify(self, email: str, official_domain: str, source_url: str) -> dict[str, Any]: ...
