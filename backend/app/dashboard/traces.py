"""
Trace Service

Provides distributed tracing functionality for workflow visualization.
Based on: test_ex/search.py (Scenario 4), test_ex/rag.py (analyze_trace_log)
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

import weaviate
from app.core.weaviate_adapter import (
    search_executions, find_by_trace_id, analyze_trace_log
)
from app.core.config import settings

logger = logging.getLogger(__name__)


class TraceService:
    """
    Provides distributed tracing for the dashboard.
    """

    def __init__(self, client: weaviate.WeaviateClient):
        self.client = client
        self.settings = settings

    def get_trace(self, trace_id: str) -> Dict[str, Any]:
        """
        Returns all spans for a specific trace ID, formatted for waterfall visualization.
        Based on: test_ex/search.py - Scenario 4
        
        Args:
            trace_id: The trace ID to look up
            
        Returns:
            {
                "trace_id": str,
                "spans": [...],
                "total_duration_ms": float,
                "start_time": str,
                "end_time": str,
                "status": str ('SUCCESS', 'ERROR', 'PARTIAL')
            }
        """
        try:
            spans = find_by_trace_id(self.client, trace_id)
            
            if not spans:
                return {
                    "trace_id": trace_id,
                    "spans": [],
                    "total_duration_ms": 0,
                    "start_time": None,
                    "end_time": None,
                    "status": "NOT_FOUND"
                }
            
            # Process spans for waterfall view
            processed_spans = []
            total_duration = 0
            has_error = False
            
            start_times = []
            end_times = []
            
            for span in spans:
                processed = self._process_span_for_waterfall(span)
                processed_spans.append(processed)
                
                duration = span.get('duration_ms', 0)
                total_duration += duration
                
                if span.get('status') == 'ERROR':
                    has_error = True
                
                timestamp = span.get('timestamp_utc')
                if timestamp:
                    start_times.append(timestamp)
            
            # Determine overall status
            if has_error:
                overall_status = "ERROR"
            elif all(s.get('status') == 'SUCCESS' for s in spans):
                overall_status = "SUCCESS"
            else:
                overall_status = "PARTIAL"
            
            return {
                "trace_id": trace_id,
                "spans": processed_spans,
                "span_count": len(processed_spans),
                "total_duration_ms": round(total_duration, 2),
                "start_time": min(start_times) if start_times else None,
                "status": overall_status
            }
            
        except Exception as e:
            logger.error(f"Failed to get trace {trace_id}: {e}")
            return {
                "trace_id": trace_id,
                "spans": [],
                "total_duration_ms": 0,
                "start_time": None,
                "end_time": None,
                "status": "ERROR",
                "error": str(e)
            }

    def get_recent_traces(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Returns a list of recent unique traces.
        
        Returns:
            [
                {
                    "trace_id": str,
                    "root_function": str,
                    "start_time": str,
                    "total_duration_ms": float,
                    "span_count": int,
                    "status": str
                },
                ...
            ]
        """
        try:
            # Get recent executions
            recent = search_executions(
                self.client,
                limit=500,  # Fetch more to find unique traces
                sort_by="timestamp_utc",
                sort_ascending=False
            )
            
            # Group by trace_id
            trace_map: Dict[str, List[Dict]] = {}
            for execution in recent:
                trace_id = execution.get('trace_id')
                if trace_id:
                    if trace_id not in trace_map:
                        trace_map[trace_id] = []
                    trace_map[trace_id].append(execution)
            
            # Build trace summaries
            traces = []
            for trace_id, spans in list(trace_map.items())[:limit]:
                # Find root span (no parent)
                root_span = None
                for span in spans:
                    if not span.get('parent_span_id'):
                        root_span = span
                        break
                
                if not root_span:
                    root_span = spans[0]  # Fallback
                
                total_duration = sum(s.get('duration_ms', 0) for s in spans)
                has_error = any(s.get('status') == 'ERROR' for s in spans)
                
                traces.append({
                    "trace_id": trace_id,
                    "root_function": root_span.get('function_name', 'unknown'),
                    "start_time": root_span.get('timestamp_utc'),
                    "total_duration_ms": round(total_duration, 2),
                    "span_count": len(spans),
                    "status": "ERROR" if has_error else "SUCCESS"
                })
            
            return traces
            
        except Exception as e:
            logger.error(f"Failed to get recent traces: {e}")
            return []

    def analyze_trace(self, trace_id: str, language: str = "en", openai_api_key: str | None = None) -> Dict[str, Any]:
        """
        Uses LLM to analyze a trace and provide insights.
        Based on: test_ex/rag.py - analyze_trace_log

        Args:
            trace_id: The trace ID to analyze
            language: Language for analysis ('en' or 'ko')
            openai_api_key: User's decrypted OpenAI API key

        Returns:
            {
                "trace_id": str,
                "analysis": str,
                "language": str
            }
        """
        try:
            analysis = analyze_trace_log(
                self.client,
                trace_id=trace_id,
                language=language,
                openai_api_key=openai_api_key,
            )
            
            return {
                "trace_id": trace_id,
                "analysis": analysis,
                "language": language
            }
            
        except Exception as e:
            logger.error(f"Failed to analyze trace {trace_id}: {e}")
            return {
                "trace_id": trace_id,
                "analysis": f"Analysis failed: {str(e)}",
                "language": language,
                "error": str(e)
            }

    def _process_span_for_waterfall(self, span: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes a span for waterfall visualization.
        Adds computed fields for UI rendering.
        """
        return {
            "span_id": span.get('span_id'),
            "parent_span_id": span.get('parent_span_id'),
            "function_name": span.get('function_name'),
            "status": span.get('status'),
            "duration_ms": round(span.get('duration_ms', 0), 2),
            "timestamp_utc": span.get('timestamp_utc'),
            "error_code": span.get('error_code'),
            "error_message": span.get('error_message'),
            # Captured attributes (useful for debugging)
            "attributes": {
                k: v for k, v in span.items()
                if k not in [
                    'span_id', 'parent_span_id', 'trace_id', 'function_name',
                    'status', 'duration_ms', 'timestamp_utc', 'error_code',
                    'error_message', 'function_uuid', 'return_value'
                ] and v is not None
            }
        }

    def build_span_tree(self, spans: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Builds a hierarchical tree structure from flat spans list.
        Useful for tree-view UI components.
        
        Args:
            spans: List of processed spans
            
        Returns:
            Nested list with 'children' field for each span
        """
        # Index spans by span_id
        span_map = {s['span_id']: {**s, 'children': []} for s in spans}
        
        # Build tree
        roots = []
        for span in spans:
            span_with_children = span_map[span['span_id']]
            parent_id = span.get('parent_span_id')
            
            if parent_id and parent_id in span_map:
                span_map[parent_id]['children'].append(span_with_children)
            else:
                roots.append(span_with_children)
        
        return roots
