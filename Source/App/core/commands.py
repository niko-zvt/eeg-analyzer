"""Command pattern and undo/redo history."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Callable


class Command(ABC):
    """Reversible user action."""

    @abstractmethod
    def execute(self) -> None:
        pass

    @abstractmethod
    def undo(self) -> None:
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        pass


class CallbackCommand(Command):
    """Command backed by execute/undo callbacks."""

    def __init__(
        self,
        execute_fn: Callable[[], None],
        undo_fn: Callable[[], None],
        description: str,
    ) -> None:
        self._execute_fn = execute_fn
        self._undo_fn = undo_fn
        self._description = description

    def execute(self) -> None:
        self._execute_fn()

    def undo(self) -> None:
        self._undo_fn()

    @property
    def description(self) -> str:
        return self._description


class CommandHistory:
    """Unified undo/redo stack for filters and zones."""

    def __init__(self) -> None:
        self._undo_stack: list[Command] = []
        self._redo_stack: list[Command] = []

    def push(self, command: Command, *, execute: bool = True) -> None:
        if execute:
            command.execute()
        self._undo_stack.append(command)
        self._redo_stack.clear()

    def undo(self) -> bool:
        if not self._undo_stack:
            return False
        command = self._undo_stack.pop()
        command.undo()
        self._redo_stack.append(command)
        return True

    def redo(self) -> bool:
        if not self._redo_stack:
            return False
        command = self._redo_stack.pop()
        command.execute()
        self._undo_stack.append(command)
        return True

    def clear(self) -> None:
        self._undo_stack.clear()
        self._redo_stack.clear()

    @property
    def can_undo(self) -> bool:
        return bool(self._undo_stack)

    @property
    def can_redo(self) -> bool:
        return bool(self._redo_stack)
