"""
Semantic Analysis Service

Vector-based analytics using PCA, KMeans, NearestNeighbors.
Requires: numpy, scikit-learn
"""

import logging
from typing import Dict, Any, Optional, List

import numpy as np
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from sklearn.neighbors import NearestNeighbors

import weaviate
import weaviate.classes.query as wvc_query

from app.core.config import settings

logger = logging.getLogger(__name__)


class SemanticAnalysisService:
    """Provides vector-based semantic analysis for the dashboard."""

    def __init__(self, client: weaviate.WeaviateClient, openai_api_key: str | None = None):
        self.client = client
        self.openai_api_key = openai_api_key
        self.exec_collection_name = settings.EXECUTION_COLLECTION_NAME
        self.golden_collection_name = settings.GOLDEN_COLLECTION_NAME

    # ============================================================
    # D12: Input Distribution Scatter (2D)
    # ============================================================

    def get_input_scatter(
        self, function_name: str | None = None, limit: int = 200
    ) -> List[Dict[str, Any]]:
        """
        Fetch execution vectors from Weaviate, project to 2D via PCA.
        Returns: [{x, y, span_id, function_name, status, duration_ms}]
        """
        collection = self.client.collections.get(self.exec_collection_name)

        wv_filter = None
        if function_name:
            wv_filter = wvc_query.Filter.by_property("function_name").equal(function_name)

        results = collection.query.fetch_objects(
            filters=wv_filter,
            limit=limit,
            include_vector=True,
        )

        if not results.objects:
            return []

        objects_with_vectors = [
            obj for obj in results.objects
            if obj.vector and obj.vector.get("default")
        ]

        if len(objects_with_vectors) < 2:
            return []

        vectors = np.array([obj.vector["default"] for obj in objects_with_vectors])

        n_components = min(2, vectors.shape[0], vectors.shape[1])
        pca = PCA(n_components=n_components)
        coords = pca.fit_transform(vectors)

        scatter = []
        for i, obj in enumerate(objects_with_vectors):
            props = obj.properties
            scatter.append({
                "x": round(float(coords[i][0]), 4),
                "y": round(float(coords[i][1]), 4) if n_components == 2 else 0.0,
                "span_id": props.get("span_id", ""),
                "function_name": props.get("function_name", ""),
                "status": props.get("status", ""),
                "duration_ms": float(props.get("duration_ms", 0)),
            })

        return scatter

    # ============================================================
    # D13: Bottleneck Semantic Analysis
    # ============================================================

    def get_bottleneck_clusters(
        self,
        function_name: str | None = None,
        n_clusters: int = 5,
        limit: int = 300,
    ) -> List[Dict[str, Any]]:
        """
        Cluster execution vectors with KMeans, compare per-cluster avg latency.
        Returns: [{cluster_id, avg_duration_ms, count, representative_input, is_bottleneck}]
        """
        collection = self.client.collections.get(self.exec_collection_name)

        wv_filter = None
        if function_name:
            wv_filter = wvc_query.Filter.by_property("function_name").equal(function_name)

        results = collection.query.fetch_objects(
            filters=wv_filter,
            limit=limit,
            include_vector=True,
        )

        objects_with_vectors = [
            obj for obj in results.objects
            if obj.vector and obj.vector.get("default")
        ]

        if len(objects_with_vectors) < n_clusters:
            return []

        vectors = np.array([obj.vector["default"] for obj in objects_with_vectors])
        durations = [float(obj.properties.get("duration_ms", 0)) for obj in objects_with_vectors]

        actual_k = min(n_clusters, len(objects_with_vectors))
        kmeans = KMeans(n_clusters=actual_k, random_state=42, n_init=10)
        labels = kmeans.fit_predict(vectors)

        global_avg = np.mean(durations) if durations else 0.0

        clusters = []
        for cid in range(actual_k):
            mask = labels == cid
            cluster_durations = [d for d, m in zip(durations, mask) if m]
            cluster_objs = [o for o, m in zip(objects_with_vectors, mask) if m]

            avg_dur = np.mean(cluster_durations) if cluster_durations else 0.0

            representative = ""
            if cluster_objs:
                rep = cluster_objs[0].properties
                representative = rep.get("function_name", "") or rep.get("span_id", "")

            clusters.append({
                "cluster_id": cid,
                "avg_duration_ms": round(float(avg_dur), 2),
                "count": int(np.sum(mask)),
                "representative_input": representative,
                "is_bottleneck": float(avg_dur) > global_avg * 2,
            })

        clusters.sort(key=lambda c: c["avg_duration_ms"], reverse=True)
        return clusters

    # ============================================================
    # D14: Golden Coverage Map
    # ============================================================

    def get_golden_coverage(
        self, function_name: str | None = None, limit: int = 500
    ) -> Dict[str, Any]:
        """
        Compare golden vectors vs execution vectors density.
        Returns: {coverage_score, total_executions, golden_count, scatter}
        """
        exec_collection = self.client.collections.get(self.exec_collection_name)

        wv_filter = None
        if function_name:
            wv_filter = wvc_query.Filter.by_property("function_name").equal(function_name)

        exec_results = exec_collection.query.fetch_objects(
            filters=wv_filter,
            limit=limit,
            include_vector=True,
        )

        exec_objs = [
            obj for obj in exec_results.objects
            if obj.vector and obj.vector.get("default")
        ]

        # Fetch golden vectors
        golden_objs = []
        if self.client.collections.exists(self.golden_collection_name):
            golden_collection = self.client.collections.get(self.golden_collection_name)
            golden_filter = None
            if function_name:
                golden_filter = wvc_query.Filter.by_property("function_name").equal(function_name)

            golden_results = golden_collection.query.fetch_objects(
                filters=golden_filter,
                limit=limit,
                include_vector=True,
            )
            golden_objs = [
                obj for obj in golden_results.objects
                if obj.vector and obj.vector.get("default")
            ]

        if not exec_objs:
            return {
                "coverage_score": 0.0,
                "total_executions": 0,
                "golden_count": len(golden_objs),
                "scatter": [],
            }

        # Combine for PCA
        all_vectors = []
        all_labels = []  # True = golden, False = execution

        for obj in exec_objs:
            all_vectors.append(obj.vector["default"])
            all_labels.append(False)

        for obj in golden_objs:
            all_vectors.append(obj.vector["default"])
            all_labels.append(True)

        vectors_np = np.array(all_vectors)
        n_components = min(2, vectors_np.shape[0], vectors_np.shape[1])
        pca = PCA(n_components=n_components)
        coords = pca.fit_transform(vectors_np)

        # Calculate coverage: ratio of executions within threshold of a golden
        coverage_score = 0.0
        if golden_objs and exec_objs:
            golden_vectors = np.array([obj.vector["default"] for obj in golden_objs])
            exec_vectors = np.array([obj.vector["default"] for obj in exec_objs])

            nn = NearestNeighbors(n_neighbors=1, metric="cosine")
            nn.fit(golden_vectors)
            distances, _ = nn.kneighbors(exec_vectors)

            # Threshold: distance < 0.5 is considered "covered"
            covered = np.sum(distances.flatten() < 0.5)
            coverage_score = round(float(covered / len(exec_objs)), 4)

        # Build scatter
        scatter = []
        idx = 0
        for obj in exec_objs:
            props = obj.properties
            scatter.append({
                "x": round(float(coords[idx][0]), 4),
                "y": round(float(coords[idx][1]), 4) if n_components == 2 else 0.0,
                "is_golden": False,
                "span_id": props.get("span_id", ""),
                "function_name": props.get("function_name", ""),
                "status": props.get("status", ""),
                "duration_ms": float(props.get("duration_ms", 0)),
            })
            idx += 1

        for obj in golden_objs:
            props = obj.properties
            scatter.append({
                "x": round(float(coords[idx][0]), 4),
                "y": round(float(coords[idx][1]), 4) if n_components == 2 else 0.0,
                "is_golden": True,
                "span_id": props.get("span_id", "") or props.get("original_uuid", ""),
                "function_name": props.get("function_name", ""),
                "status": props.get("status", ""),
                "duration_ms": float(props.get("duration_ms", 0)),
            })
            idx += 1

        return {
            "coverage_score": coverage_score,
            "total_executions": len(exec_objs),
            "golden_count": len(golden_objs),
            "scatter": scatter,
        }

    # ============================================================
    # D15: Discovery vs Steady Recommend
    # ============================================================

    def recommend_with_diversity(
        self, function_name: str, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Density-based candidate scoring. Mix far (Discovery) + near (Steady) from golden.
        Returns: [{uuid, span_id, function_name, status, duration_ms, score, candidate_type, distance_to_nearest_golden}]
        """
        exec_collection = self.client.collections.get(self.exec_collection_name)

        fn_filter = (
            wvc_query.Filter.by_property("function_name").equal(function_name)
            & wvc_query.Filter.by_property("status").equal("SUCCESS")
        )

        exec_results = exec_collection.query.fetch_objects(
            filters=fn_filter,
            limit=limit * 5,
            include_vector=True,
        )

        exec_objs = [
            obj for obj in exec_results.objects
            if obj.vector and obj.vector.get("default")
        ]

        if not exec_objs:
            return []

        # Fetch golden vectors
        golden_vectors = []
        if self.client.collections.exists(self.golden_collection_name):
            golden_collection = self.client.collections.get(self.golden_collection_name)
            golden_filter = wvc_query.Filter.by_property("function_name").equal(function_name)
            golden_results = golden_collection.query.fetch_objects(
                filters=golden_filter,
                limit=500,
                include_vector=True,
            )
            golden_vectors = [
                obj.vector["default"] for obj in golden_results.objects
                if obj.vector and obj.vector.get("default")
            ]

        # Calculate distances to nearest golden
        candidates = []
        if golden_vectors:
            golden_np = np.array(golden_vectors)
            nn = NearestNeighbors(n_neighbors=1, metric="cosine")
            nn.fit(golden_np)

            exec_vectors = np.array([obj.vector["default"] for obj in exec_objs])
            distances, _ = nn.kneighbors(exec_vectors)

            for i, obj in enumerate(exec_objs):
                props = obj.properties
                dist = float(distances[i][0])
                candidates.append({
                    "uuid": str(obj.uuid),
                    "span_id": props.get("span_id", ""),
                    "function_name": props.get("function_name", ""),
                    "status": props.get("status", ""),
                    "duration_ms": float(props.get("duration_ms", 0)),
                    "timestamp_utc": str(props.get("timestamp_utc", "")),
                    "distance_to_nearest_golden": round(dist, 4),
                    "candidate_type": "",
                    "score": 0.0,
                })
        else:
            # No golden data: all are Discovery candidates
            for obj in exec_objs:
                props = obj.properties
                candidates.append({
                    "uuid": str(obj.uuid),
                    "span_id": props.get("span_id", ""),
                    "function_name": props.get("function_name", ""),
                    "status": props.get("status", ""),
                    "duration_ms": float(props.get("duration_ms", 0)),
                    "timestamp_utc": str(props.get("timestamp_utc", "")),
                    "distance_to_nearest_golden": 1.0,
                    "candidate_type": "DISCOVERY",
                    "score": 1.0,
                })
            return candidates[:limit]

        # Sort by distance desc for Discovery, asc for Steady
        sorted_by_dist = sorted(candidates, key=lambda c: c["distance_to_nearest_golden"], reverse=True)

        half = limit // 2
        discovery = sorted_by_dist[:half]
        steady = sorted(sorted_by_dist, key=lambda c: c["distance_to_nearest_golden"])[:limit - half]

        # Normalize scores
        max_dist = max(c["distance_to_nearest_golden"] for c in candidates) if candidates else 1.0
        if max_dist == 0:
            max_dist = 1.0

        for c in discovery:
            c["candidate_type"] = "DISCOVERY"
            c["score"] = round(c["distance_to_nearest_golden"] / max_dist, 4)

        for c in steady:
            c["candidate_type"] = "STEADY"
            c["score"] = round(1.0 - c["distance_to_nearest_golden"] / max_dist, 4)

        # Merge and deduplicate
        seen = set()
        merged = []
        for c in discovery + steady:
            if c["uuid"] not in seen:
                seen.add(c["uuid"])
                merged.append(c)

        return merged[:limit]

    # ============================================================
    # C8: Hallucination Candidate List
    # ============================================================

    def get_hallucination_candidates(
        self,
        function_name: str | None = None,
        threshold: float = 0.3,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Detect SUCCESS executions with unusually high vector distances (outliers).
        Returns: [{span_id, function_name, distance, duration_ms, timestamp_utc, input_preview, output_preview}]
        """
        collection = self.client.collections.get(self.exec_collection_name)

        filters = [wvc_query.Filter.by_property("status").equal("SUCCESS")]
        if function_name:
            filters.append(wvc_query.Filter.by_property("function_name").equal(function_name))

        wv_filter = filters[0]
        for f in filters[1:]:
            wv_filter = wv_filter & f

        results = collection.query.fetch_objects(
            filters=wv_filter,
            limit=limit * 5,
            include_vector=True,
        )

        objects_with_vectors = [
            obj for obj in results.objects
            if obj.vector and obj.vector.get("default")
        ]

        if len(objects_with_vectors) < 5:
            return []

        vectors = np.array([obj.vector["default"] for obj in objects_with_vectors])

        k = min(5, len(vectors) - 1)
        nn = NearestNeighbors(n_neighbors=k + 1, metric="cosine")
        nn.fit(vectors)
        distances, _ = nn.kneighbors(vectors)

        # Average distance to k nearest neighbors (excluding self)
        avg_distances = np.mean(distances[:, 1:], axis=1)

        candidates = []
        for i, obj in enumerate(objects_with_vectors):
            avg_dist = float(avg_distances[i])
            if avg_dist > threshold:
                props = obj.properties
                candidates.append({
                    "span_id": props.get("span_id", ""),
                    "function_name": props.get("function_name", ""),
                    "distance": round(avg_dist, 4),
                    "duration_ms": float(props.get("duration_ms", 0)),
                    "timestamp_utc": str(props.get("timestamp_utc", "")),
                    "input_preview": str(props.get("input_preview", ""))[:200],
                    "output_preview": str(props.get("return_value", props.get("output_preview", "")))[:200],
                })

        candidates.sort(key=lambda c: c["distance"], reverse=True)
        return candidates[:limit]

    # ============================================================
    # C9: Semantic Error Clustering
    # ============================================================

    def get_error_clusters(
        self, n_clusters: int = 5, limit: int = 200
    ) -> List[Dict[str, Any]]:
        """
        Cluster ERROR execution vectors to group semantically similar errors.
        Returns: [{cluster_id, count, representative_error, error_codes, functions}]
        """
        collection = self.client.collections.get(self.exec_collection_name)

        wv_filter = wvc_query.Filter.by_property("status").equal("ERROR")

        results = collection.query.fetch_objects(
            filters=wv_filter,
            limit=limit,
            include_vector=True,
        )

        objects_with_vectors = [
            obj for obj in results.objects
            if obj.vector and obj.vector.get("default")
        ]

        if len(objects_with_vectors) < n_clusters:
            # Not enough data for clustering, return individual errors
            clusters = []
            for i, obj in enumerate(objects_with_vectors):
                props = obj.properties
                clusters.append({
                    "cluster_id": i,
                    "count": 1,
                    "representative_error": str(props.get("error_message", "Unknown error"))[:300],
                    "error_codes": [props.get("error_code", "")] if props.get("error_code") else [],
                    "functions": [props.get("function_name", "")] if props.get("function_name") else [],
                })
            return clusters

        vectors = np.array([obj.vector["default"] for obj in objects_with_vectors])

        actual_k = min(n_clusters, len(objects_with_vectors))
        kmeans = KMeans(n_clusters=actual_k, random_state=42, n_init=10)
        labels = kmeans.fit_predict(vectors)

        clusters = []
        for cid in range(actual_k):
            mask = labels == cid
            cluster_objs = [o for o, m in zip(objects_with_vectors, mask) if m]

            error_codes = set()
            functions = set()
            representative_error = ""

            for obj in cluster_objs:
                props = obj.properties
                ec = props.get("error_code", "")
                fn = props.get("function_name", "")
                if ec:
                    error_codes.add(str(ec))
                if fn:
                    functions.add(str(fn))
                if not representative_error:
                    representative_error = str(props.get("error_message", "Unknown error"))[:300]

            clusters.append({
                "cluster_id": cid,
                "count": len(cluster_objs),
                "representative_error": representative_error,
                "error_codes": sorted(error_codes),
                "functions": sorted(functions),
            })

        clusters.sort(key=lambda c: c["count"], reverse=True)
        return clusters
