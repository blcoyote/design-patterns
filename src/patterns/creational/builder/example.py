import json
from dataclasses import dataclass, field
from typing import Protocol, Self
from urllib.parse import quote


# [product]
@dataclass(frozen=True)
class HttpRequest:
    method: str
    url: str
    headers: dict[str, str]
    query: dict[str, str]
    body: str | None = None
# [/product]


# [builder]
# The Builder: a Protocol so a Director can drive ANY concrete builder
# through the exact same construction steps.
class RequestBuilder(Protocol):
    def set_method(self, method: str) -> Self: ...
    def set_header(self, key: str, value: str) -> Self: ...
    def set_query(self, key: str, value: str) -> Self: ...
    def set_body(self, body: str) -> Self: ...
# [/builder]


# [httpBuilder]
# ConcreteBuilder #1: assembles a real HttpRequest object.
class HttpRequestBuilder:
    def __init__(self, url: str) -> None:
        self._url = url
        self._method = 'GET'
        self._headers: dict[str, str] = {}
        self._query: dict[str, str] = {}
        self._body: str | None = None

    def set_method(self, method: str) -> Self:
        self._method = method
        return self

    def set_header(self, key: str, value: str) -> Self:
        self._headers[key] = value
        return self

    def set_query(self, key: str, value: str) -> Self:
        self._query[key] = value
        return self

    def set_body(self, body: str) -> Self:
        self._body = body
        return self

    # [httpBuild]
    def get_result(self) -> HttpRequest:
        return HttpRequest(
            method=self._method,
            url=self._url,
            headers=dict(self._headers),
            query=dict(self._query),
            body=self._body,
        )
    # [/httpBuild]
# [/httpBuilder]


# [curlBuilder]
# ConcreteBuilder #2: the exact same steps, rendered as a curl command string.
class CurlCommandBuilder:
    def __init__(self, url: str) -> None:
        self._url = url
        self._method = 'GET'
        self._header_flags: list[str] = []
        self._query_parts: list[str] = []
        self._body: str | None = None

    def set_method(self, method: str) -> Self:
        self._method = method
        return self

    def set_header(self, key: str, value: str) -> Self:
        self._header_flags.append(f"-H '{key}: {value}'")
        return self

    def set_query(self, key: str, value: str) -> Self:
        # safe="!'()*" makes quote() escape exactly what JS encodeURIComponent does.
        encoded = quote(value, safe="!'()*")
        self._query_parts.append(f'{key}={encoded}')
        return self

    def set_body(self, body: str) -> Self:
        self._body = body
        return self

    # [curlBuild]
    def get_result(self) -> str:
        query = f"?{'&'.join(self._query_parts)}" if self._query_parts else ''
        parts = [f'curl -X {self._method}', *self._header_flags]
        if self._body:
            parts.append(f"-d '{self._body}'")
        parts.append(f"'{self._url}{query}'")
        return ' '.join(parts)
    # [/curlBuild]
# [/curlBuilder]


# [director]
class RequestDirector:
    # A reusable recipe: a JSON POST. It only knows the Builder protocol, so
    # the SAME steps can drive an HttpRequestBuilder or a CurlCommandBuilder.
    @staticmethod
    def post_json(builder: RequestBuilder, payload: object) -> None:
        builder.set_method('POST')
        builder.set_header('Content-Type', 'application/json')
        builder.set_body(json.dumps(payload, separators=(',', ':')))  # compact, like JSON.stringify
# [/director]


# Usage
# [usage]
# Same director recipe, two different concrete builders -> two representations:
http_builder = HttpRequestBuilder('/api/items')
RequestDirector.post_json(http_builder, {'name': 'Margherita'})
request: HttpRequest = http_builder.get_result()

curl_builder = CurlCommandBuilder('/api/items')
RequestDirector.post_json(curl_builder, {'name': 'Margherita'})
command: str = curl_builder.get_result()

# Skipping the director: chain a concrete builder directly for a one-off request.
search = HttpRequestBuilder('/api/items').set_query('q', 'pizza').get_result()
# [/usage]
