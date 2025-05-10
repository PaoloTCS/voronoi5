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

    def encode_path(self, edge_prime_ids: List[gmpy2.mpz]) -> Optional[Tuple[gmpy2.mpz, int]]:
        """
        Encodes a path represented by a list of canonical prime IDs for its edges.

        Args:
            edge_prime_ids: List of gmpy2.mpz prime numbers representing edges.

        Returns:
            A tuple (C, d) where C is the final encoded BigInt and d is the depth of encoding,
            or None if encoding fails.
        """
        if not edge_prime_ids:
            print("Warning: Cannot encode an empty path.")
            return None

        current_code = self._product_gmpy(edge_prime_ids)
        current_depth = 0

        # Iterative lifting if code exceeds limits or for fixed depth based on block size
        # For now, a simple single lift if needed based on depth_limit,
        # or more accurately, if the product itself becomes an index too large for get_nth_prime_gmpy'''s cache quickly.
        # The framework paper implies multiple lifts based on block size, which is more complex.
        # Let'''s start with a version that performs lifts until C is "manageable" or depth_limit is hit.
        # True block-based lifting requires segmenting edge_prime_ids or products.

        # Simplified: if depth_limit > 0, we lift once if there'''s more than one prime.
        # This isn'''t the full recursive block encoding from the paper yet.
        # It'''s a step towards it.

        # Let'''s implement one level of lifting for now if there are multiple primes
        if len(edge_prime_ids) > 1 and self.depth_limit > 0 : # Only lift if multiple primes and depth allows
             try:
                  # The "code" (product of primes) becomes the index for the next prime
                  # This requires prime_index(product) to be a valid integer index
                  # and then get_nth_prime(that_index). This is P(m) = p_m
                  # But the product itself is '''m'''. We need the product'''s index IF it were prime.
                  # The paper states: P(m) = p_m where p_m is the m-th prime.
                  # So, current_code IS '''m'''. We need the m-th prime.
                  
                  # We need to ensure current_code doesn'''t become astronomically large such that
                  # get_nth_prime_gmpy(current_code) would be infeasible.
                  # The paper'''s "block" concept is designed to manage this by lifting products of smaller blocks.

                  # Simplified approach for now (closer to a single lift of the product):
                  # Convert the product to an integer to use as an index.
                  # This is risky if current_code is massive.
                  # The framework'''s "m-th prime" means current_code itself *is* m.
                  m_index = int(current_code) # This can fail if current_code is too large for standard int
                  if m_index > 10**7: # Arbitrary limit to prevent extremely slow get_nth_prime
                       print(f"Warning: Product {current_code} too large for direct m-th prime lookup. Path encoding may be too complex for simple lift.")
                       # In a full implementation, we'''d apply block-based lifting BEFORE this.
                       # For now, return the unlifted code if too large for m-th prime.
                       return current_code, current_depth
                  
                  lifted_code = get_nth_prime_gmpy(m_index)
                  current_code = lifted_code
                  current_depth = 1 # Mark that one lift occurred
             except OverflowError:
                  print(f"OverflowError: Product {current_code} too large to convert to int for m-th prime. Returning unlifted code.")
                  return current_code, 0 # Return original product and depth 0
             except ValueError as ve: # From get_nth_prime_gmpy if index is bad
                  print(f"ValueError during lifting: {ve}. Product was {current_code}. Returning unlifted.")
                  return self._product_gmpy(edge_prime_ids), 0


        # For a full block-based recursive encoding as per the paper:
        # TODO: Implement recursive block processing and lifting here.
        # This involves:
        # 1. Splitting edge_prime_ids into blocks of self.block_size.
        # 2. Calculating product for each block.
        # 3. If number of block-products > 1, recursively call encode_path on these products (as new edge_prime_ids).
        # 4. Increment current_depth at each level of recursion.
        # 5. Stop when only one code remains or depth_limit is reached.

        return current_code, current_depth

    def decode_path(self, code: gmpy2.mpz, depth: int) -> Optional[List[gmpy2.mpz]]:
        """
        Decodes a path code (C, d) back into a list of edge prime IDs.

        Args:
            code: The encoded BigInt C.
            depth: The depth d of encoding.

        Returns:
            A list of gmpy2.mpz prime numbers representing the edges, or None if decoding fails.
        """
        if depth < 0:
            print("Error: Depth cannot be negative.")
            return None

        current_decoded_primes = [code] # Start with the code itself

        # Iteratively unlift based on depth
        # This simplified version assumes single lift. True unlifting needs to match block structure.
        for _ in range(depth):
            if len(current_decoded_primes) != 1:
                print("Error: Expected single code for unlifting at this depth.")
                return None
            
            code_to_unlift = current_decoded_primes[0]
            
            # Unlift: code_to_unlift is the p_m. We need '''m''', which is its prime_index.
            # Then, '''m''' is the product of primes from the lower level.
            m_index = prime_index_gmpy(code_to_unlift)
            if m_index is None:
                print(f"Error: Could not find prime index for {code_to_unlift} during unlifting.")
                return None
            
            # '''m_index''' is now the product from the previous level. Factorize it.
            # The paper uses '''m''' as the product.
            # P(m) = p_m --> code_to_unlift is p_m.
            # So, the index of p_m is m.
            # The value '''m''' (the index) is the product we need to factorize.
            product_from_lower_level = gmpy2.mpz(m_index) # The index *is* the product
            current_decoded_primes = prime_factors_gmpy(product_from_lower_level)
            
            if not current_decoded_primes: # Factoring failed or resulted in no primes
                print(f"Error: Factoring {product_from_lower_level} yielded no primes.")
                return None
        
        # For a full block-based recursive decoding:
        # TODO: Implement recursive unlifting and unblocking here.
        # This involves:
        # 1. If depth > 0, get prime_index of '''code''' to get the product from level d-1.
        # 2. Factorize this product to get the codes from level d-1.
        # 3. Recursively call decode_path on these codes with depth-1.
        # 4. Concatenate results.
        # 5. If depth == 0, '''code''' is already a product of edge primes, so factorize it.

        # If depth is 0, the current_decoded_primes should be the list of actual edge primes
        # (if the initial code was a product, and not a single prime itself).
        # If depth is 0 and the code was a single prime, factorizing it will return itself.
        if depth == 0:
             # The code is the product of primes. Factorize it.
             return prime_factors_gmpy(code)

        return current_decoded_primes 