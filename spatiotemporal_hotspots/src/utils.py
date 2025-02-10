import numpy as np
from typing import List
from .hotspot_detector import SpatiotemporalPoint

def generate_sample_data(n_points: int, 
                        x_range: tuple = (0, 100),
                        y_range: tuple = (0, 100),
                        t_range: tuple = (0, 100)) -> List[SpatiotemporalPoint]:
    """
    Generate sample spatiotemporal points for testing.
    """
    x_coords = np.random.uniform(x_range[0], x_range[1], n_points)
    y_coords = np.random.uniform(y_range[0], y_range[1], n_points)
    timestamps = np.random.uniform(t_range[0], t_range[1], n_points)
    
    return [SpatiotemporalPoint(x, y, t) 
            for x, y, t in zip(x_coords, y_coords, timestamps)] 