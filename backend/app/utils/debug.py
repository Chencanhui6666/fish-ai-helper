"""JSON-style inspection without consuming iterators or streams."""

import inspect
import json
from collections.abc import Mapping


def print_object(obj, *, max_depth=5, include_private=True, include_properties=False):
    """Print nested data, instance attributes, and optionally computed properties.

    Properties are opt-in because reading them can execute code. Iterators and
    streams are inspected as objects; they are never consumed to collect data.
    """
    active = set()

    def expand(value, depth):
        if value is None or isinstance(value, (str, bool, int, float)):
            return value
        if callable(value):
            return f"<callable: {getattr(value, '__qualname__', type(value).__name__)}>"
        if id(value) in active:
            return "<circular reference>"
        if depth >= max_depth:
            return f"<max depth: {type(value).__name__}>"

        active.add(id(value))
        try:
            if isinstance(value, Mapping):
                return {str(key): expand(item, depth + 1) for key, item in value.items()}
            if isinstance(value, (list, tuple, set, frozenset)):
                return [expand(item, depth + 1) for item in value]

            attributes = dict(getattr(value, "__dict__", {}))
            for cls in type(value).__mro__:
                slots = cls.__dict__.get("__slots__", ())
                if isinstance(slots, str):
                    slots = (slots,)
                for name in slots:
                    if name.startswith("__"):
                        continue
                    try:
                        attributes.setdefault(name, getattr(value, name))
                    except AttributeError:
                        pass

            result = {"__type__": type(value).__name__}
            for name, item in attributes.items():
                if include_private or not name.startswith("_"):
                    result[name] = expand(item, depth + 1)

            if include_properties:
                for name in dir(type(value)):
                    if name in result or (name.startswith("_") and not include_private):
                        continue
                    descriptor = inspect.getattr_static(type(value), name)
                    if isinstance(descriptor, property):
                        try:
                            result[name] = expand(getattr(value, name), depth + 1)
                        except Exception as exc:
                            result[name] = f"<error: {type(exc).__name__}>"
            return result
        finally:
            active.remove(id(value))

    print(json.dumps(expand(obj, 0), ensure_ascii=False, indent=2))
