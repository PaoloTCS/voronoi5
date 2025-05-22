import gmpy2
from typing import List, Tuple, Optional

# --- Prime Number Utilities (using gmpy2) ---
# Global cache for primes and prime indices for efficiency
# These will be populated by _ensure_primes_up_to_n
_PRIMES_LIST_GMPY = []
_MAX_PRIME_CACHED_GMPY = gmpy2.mpz(0)

def _is_prime_gmpy(n: gmpy2.mpz) -> bool:
    """Checks if a gmpy2.mpz number is prime."""
    if n < 2:
        return False
    return gmpy2.is_prime(n) > 0 # gmpy2.is_prime returns 2 for prime, 1 for probably prime, 0 for composite

def _ensure_primes_up_to_n(n_primes_needed: int):
    """
    Ensures the _PRIMES_LIST_GMPY contains at least n_primes_needed primes.
    Uses a basic sieve or gmpy2.next_prime for extension.
    """
    global _PRIMES_LIST_GMPY, _MAX_PRIME_CACHED_GMPY
    
    if len(_PRIMES_LIST_GMPY) >= n_primes_needed:
        return

    if not _PRIMES_LIST_GMPY:
        current_prime = gmpy2.mpz(2)
        _PRIMES_LIST_GMPY.append(current_prime)
        _MAX_PRIME_CACHED_GMPY = current_prime
    else:
        current_prime = _MAX_PRIME_CACHED_GMPY

    while len(_PRIMES_LIST_GMPY) < n_primes_needed:
        current_prime = gmpy2.next_prime(current_prime)
        _PRIMES_LIST_GMPY.append(current_prime)
    
    _MAX_PRIME_CACHED_GMPY = _PRIMES_LIST_GMPY[-1]
    # print(f"DEBUG: Extended primes list to {len(_PRIMES_LIST_GMPY)} primes, up to {_MAX_PRIME_CACHED_GMPY}")


def get_nth_prime_gmpy(n: int) -> gmpy2.mpz:
    """
    Returns the n-th prime number (1-indexed: 1st prime is 2).
    Uses gmpy2 and extends a cached list of primes as needed.
    """
    if n <= 0:
        raise ValueError("Prime index n must be positive.")
    
    _ensure_primes_up_to_n(n) # Ensure our list is long enough
    
    if n > len(_PRIMES_LIST_GMPY):
        # This case should ideally not be hit if _ensure_primes_up_to_n works correctly
        # or if n is extremely large, exceeding reasonable cache.
        # For very large n, gmpy2.nth_prime might be slow if not pre-calculated by a sieve.
        # Fallback for extremely large n (though typically we expect to use cached primes)
        # This is a placeholder and might be inefficient for very large n.
        print(f"Warning: Requesting {n}-th prime, which is beyond current cache size. Extending dynamically.")
        # This simple extension is okay for moderate n, but a full sieve is better for many large primes.
        while len(_PRIMES_LIST_GMPY) < n:
             _ensure_primes_up_to_n(len(_PRIMES_LIST_GMPY) + 100) # Extend in batches
        # If still not enough, it means n is very large; gmpy2.nth_prime might be the only direct way
        # but can be slow. The current _ensure_primes_up_to_n should handle this.

    return _PRIMES_LIST_GMPY[n-1]


def prime_index_gmpy(p: gmpy2.mpz) -> Optional[int]:
    """
    Returns the 1-based index of a prime p (e.g., prime_index(2) = 1).
    Relies on the cached _PRIMES_LIST_GMPY. For primes beyond cache, it'''s more complex.
    """
    if not _is_prime_gmpy(p):
        # print(f"Warning: {p} is not prime, cannot find index.")
        return None
    
    # Ensure primes are cached up to p (or a bit beyond for safety)
    # This is tricky: how many primes to cache to include p?
    # A rough estimate: p / log(p). For now, just try finding it.
    if p > _MAX_PRIME_CACHED_GMPY:
        # Extend cache towards p, this can be slow if p is large and far from cache
        temp_n_estimate = int(gmpy2.log(p) / gmpy2.log(gmpy2.log(p)) * (p / gmpy2.log(p))) if p > 100 else 100
        print(f"Prime {p} is larger than cached max {_MAX_PRIME_CACHED_GMPY}. Attempting to extend cache up to approx index {temp_n_estimate}.")
        _ensure_primes_up_to_n(max(len(_PRIMES_LIST_GMPY) + 100, temp_n_estimate))


    try:
        # List.index() finds first occurrence, 0-indexed. Add 1 for 1-based prime index.
        return _PRIMES_LIST_GMPY.index(p) + 1
    except ValueError:
        print(f"Prime {p} not found in current prime cache (up to {_MAX_PRIME_CACHED_GMPY}). Consider extending cache further.")
        return None # Or raise error, or try gmpy2.is_prime and count up (slow)

def prime_factors_gmpy(n: gmpy2.mpz) -> List[gmpy2.mpz]:
    """
    Returns a list of prime factors of n, using gmpy2.
    Factors are returned in ascending order, with multiplicity.
    Example: prime_factors_gmpy(12) -> [mpz(2), mpz(2), mpz(3)]
    """
    if n < 2:
        return []
    
    factors = []
    d = gmpy2.mpz(2)
    temp_n = gmpy2.mpz(n) # Work with a copy
    
    while d * d <= temp_n:
        while temp_n % d == 0:
            factors.append(gmpy2.mpz(d)) # Store as mpz
            temp_n //= d
        d += 1
    
    if temp_n > 1: # Remaining n is prime
        factors.append(gmpy2.mpz(temp_n))
            
    return sorted(factors) # Ensure sorted order

# --- Path Encoding Service Class ---
class PathEncodingService:
    def __init__(self, block_size: int = 5, depth_limit: int = 3):
        self.block_size = block_size
        self.depth_limit = depth_limit
        # Initialize prime cache to a reasonable starting point if desired
        _ensure_primes_up_to_n(1000) # e.g., pre-cache first 1000 primes

    def _product_gmpy(self, numbers: List[gmpy2.mpz]) -> gmpy2.mpz:
        """Calculates product of a list of gmpy2.mpz numbers."""
        if not numbers:
            return gmpy2.mpz(1) # Multiplicative identity
        res = gmpy2.mpz(1)
        for num in numbers:
            res = gmpy2.mul(res, num)
        return res

    def encode_path(self, edge_atomic_primes: List[gmpy2.mpz]) -> Optional[Tuple[gmpy2.mpz, int]]:
        """
        Encodes an ordered path using Gödel-style encoding: C = P_1^e1 * P_2^e2 * ...
        where P_j is the j-th prime number (2,3,5...) and e_i is the small prime for the i-th edge.
        """
        if not edge_atomic_primes:
            print("Warning: Cannot encode an empty path.")
            return None

        # Ensure we have enough base primes (2, 3, 5, ...) for the Gödel encoding
        num_edges = len(edge_atomic_primes)
        _ensure_primes_up_to_n(num_edges) # Ensures _PRIMES_LIST_GMPY has at least P_1 to P_num_edges

        if num_edges > len(_PRIMES_LIST_GMPY):
            print(f"Error: Not enough base primes in cache for {num_edges} edges.")
            return None # Should be caught by _ensure_primes_up_to_n ideally

        encoded_c = gmpy2.mpz(1)
        for i, edge_prime_exponent in enumerate(edge_atomic_primes):
            base_prime = _PRIMES_LIST_GMPY[i] # P_(i+1) because list is 0-indexed
            try:
                # Ensure exponent is a Python int for gmpy2.pow() if it expects that,
                # though gmpy2.mpz should also work. Let's cast to be safe.
                exponent_val = int(edge_prime_exponent)
                term = gmpy2.pow(base_prime, exponent_val)
                encoded_c = gmpy2.mul(encoded_c, term)
            except OverflowError:
                print(f"OverflowError: Exponent {edge_prime_exponent} too large for base {base_prime}.")
                return None
            except Exception as e:
                print(f"Error during encoding term {i+1} (base {base_prime}, exp {edge_prime_exponent}): {e}")
                return None
        
        current_depth = 0 # No lifting of the final Gödel number C itself yet
        # TODO: Implement optional lifting of 'encoded_c' based on self.depth_limit
        #       and self.block_size if 'encoded_c' itself is considered for further compression.

        return encoded_c, current_depth

    def decode_path(self, code_c: gmpy2.mpz, depth: int) -> Optional[List[gmpy2.mpz]]:
        """
        Decodes a Gödel-style path code C back into a list of its edge atomic primes [e1, e2, ...].
        Assumes depth=0 for now (no lifting of C itself).
        """
        if depth != 0:
            # TODO: Implement unlifting of C if depth > 0
            print("Warning: Multi-depth decoding not yet implemented. Assuming depth 0.")
            # For now, proceed as if C is the base Gödel number

        if code_c < 2: # Smallest Gödel number is 2^e1
            print("Error: Invalid code for decoding (must be >= 2).")
            return None

        decoded_edge_primes = []
        temp_code = gmpy2.mpz(code_c)
        prime_idx_for_base = 0 # To get P_1 (2), P_2 (3), ...

        while temp_code > 1:
            prime_idx_for_base += 1
            # Ensure we have the base prime (P_j) in our cache
            # Max number of edges is practically limited, so this should be okay
            _ensure_primes_up_to_n(prime_idx_for_base) 
            if prime_idx_for_base > len(_PRIMES_LIST_GMPY):
                print(f"Error: Ran out of base primes during decoding. Code {code_c} might be too complex or corrupted.")
                return None # Or partial list
            
            current_base_prime = _PRIMES_LIST_GMPY[prime_idx_for_base - 1] # Get P_j

            if temp_code % current_base_prime == 0:
                count, remainder = gmpy2.remove(temp_code, current_base_prime)
                # 'count' is the exponent e_j, which is the atomic prime for that edge
                decoded_edge_primes.append(gmpy2.mpz(count))
                temp_code = remainder
                if remainder == 0: # Should not happen if temp_code was > 1
                    print("Error: Decoding resulted in zero remainder unexpectedly.")
                    return None
            else:
                # This base prime is not a factor, means its exponent was 0,
                # implying the path was shorter than the current prime_idx_for_base.
                # This assumes all exponents e_i are > 0. If e_i can be 0, logic needs adjustment.
                # For now, if a base prime isn't a factor, we assume end of sequence.
                break 
        
        if temp_code > 1:
            print(f"Warning: Decoding finished with remainder {temp_code}. Code might be corrupted or involve primes beyond cache for bases.")
            return None # Indicates incomplete or failed decoding

        return decoded_edge_primes 