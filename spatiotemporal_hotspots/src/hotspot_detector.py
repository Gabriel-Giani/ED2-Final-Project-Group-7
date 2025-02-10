import numpy as np
from typing import List, Tuple, Union
from dataclasses import dataclass

@dataclass
class SpatiotemporalPoint:
    x: float
    y: float
    timestamp: float
    value: float = 1.0

class HotspotDetector:
    def __init__(self, spatial_threshold: float, temporal_threshold: float, min_points: int = 3):
        """
        Initialize the hotspot detector.
        
        Args:
            spatial_threshold: Maximum distance between points to be considered neighbors
            temporal_threshold: Maximum time difference between points to be considered related
            min_points: Minimum number of points to form a hotspot
        """
        self.spatial_threshold = spatial_threshold
        self.temporal_threshold = temporal_threshold
        self.min_points = min_points

    def detect_hotspots(self, points: List[SpatiotemporalPoint]) -> List[List[SpatiotemporalPoint]]:
        """
        Detect spatiotemporal hotspots in the given points.
        
        Args:
            points: List of SpatiotemporalPoint objects
            
        Returns:
            List of hotspots, where each hotspot is a list of points
        """
        hotspots = []
        visited = set()

        for i, point in enumerate(points):
            if i in visited:
                continue

            cluster = self._expand_cluster(points, i, visited)
            if len(cluster) >= self.min_points:
                hotspots.append(cluster)

        return hotspots

    def _expand_cluster(self, points: List[SpatiotemporalPoint], point_idx: int, 
                       visited: set) -> List[SpatiotemporalPoint]:
        """
        Expand cluster from a seed point using spatiotemporal neighborhood criteria.
        """
        cluster = [points[point_idx]]
        visited.add(point_idx)
        
        neighbors = self._get_neighbors(points, point_idx)
        stack = neighbors.copy()
        
        while stack:
            neighbor_idx = stack.pop()
            if neighbor_idx not in visited:
                visited.add(neighbor_idx)
                cluster.append(points[neighbor_idx])
                
                new_neighbors = self._get_neighbors(points, neighbor_idx)
                stack.extend(n for n in new_neighbors if n not in visited)
        
        return cluster

    def _get_neighbors(self, points: List[SpatiotemporalPoint], point_idx: int) -> List[int]:
        """
        Find indices of neighboring points based on spatial and temporal thresholds.
        """
        neighbors = []
        point = points[point_idx]
        
        for i, other in enumerate(points):
            if i != point_idx:
                spatial_dist = np.sqrt((point.x - other.x)**2 + (point.y - other.y)**2)
                temporal_dist = abs(point.timestamp - other.timestamp)
                
                if (spatial_dist <= self.spatial_threshold and 
                    temporal_dist <= self.temporal_threshold):
                    neighbors.append(i)
                    
        return neighbors 