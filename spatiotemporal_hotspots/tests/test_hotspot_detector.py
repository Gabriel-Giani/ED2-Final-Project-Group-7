import unittest
from src.hotspot_detector import HotspotDetector, SpatiotemporalPoint
from src.utils import generate_sample_data

class TestHotspotDetector(unittest.TestCase):
    def setUp(self):
        self.detector = HotspotDetector(
            spatial_threshold=10.0,
            temporal_threshold=5.0,
            min_points=3
        )

    def test_detect_hotspots(self):
        # Create a known cluster of points
        cluster_points = [
            SpatiotemporalPoint(0, 0, 0),
            SpatiotemporalPoint(1, 1, 1),
            SpatiotemporalPoint(2, 2, 2),
            SpatiotemporalPoint(50, 50, 50)  # Outlier
        ]
        
        hotspots = self.detector.detect_hotspots(cluster_points)
        
        self.assertEqual(len(hotspots), 1)
        self.assertEqual(len(hotspots[0]), 3)

if __name__ == '__main__':
    unittest.main() 