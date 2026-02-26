import numpy as np
from .config import MOD_P

def compute_masked_dot(masked_vector, matrix):
    masked_vector = np.array(masked_vector, dtype=np.int64)
    matrix = np.array(matrix, dtype=np.int64)
    result = np.dot(masked_vector, matrix) % MOD_P
    return result.tolist()