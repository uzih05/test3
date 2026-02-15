"""
VectorWave Dashboard Service Layer

This module provides high-level APIs for building monitoring dashboards.
All functions are designed to return JSON-serializable dictionaries.
"""

from .overview import DashboardOverviewService
from .executions import ExecutionService
from .traces import TraceService
from .functions import FunctionService
from .errors import ErrorService
from .healer import HealerService
from .cache import CacheService
from .golden_dataset import GoldenDatasetService
from .drift import DriftService
from .semantic_analysis import SemanticAnalysisService
from .ask_ai import AskAiService

__all__ = [
    'DashboardOverviewService',
    'ExecutionService',
    'TraceService',
    'FunctionService',
    'ErrorService',
    'HealerService',
    'CacheService',
    'GoldenDatasetService',
    'DriftService',
    'SemanticAnalysisService',
    'AskAiService',
]
