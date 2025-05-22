from typing import List, Optional
from models.knowledge_graph import KnowledgeGraph # Assuming KnowledgeGraph is defined
from models.document import Document # Example, adjust as needed
import gmpy2 # If primes are used here

class KnowledgeGraphService:
    def __init__(self, knowledge_graph: Optional[KnowledgeGraph] = None):
        self.graph = knowledge_graph if knowledge_graph else KnowledgeGraph(name="MainKG")
        # TODO: Initialize prime assignment strategy related data if needed
        # e.g., self.prime_map_for_nodes = {}

    def add_document_to_graph(self, document: Document):
        # TODO: Logic to add document and its chunks as nodes,
        # and 'contains' edges.
        print(f"Placeholder: Adding document {document.title} to graph.")
        pass

    def get_sorted_neighbor_labels(self, source_node_label: str) -> List[str]:
        """
        Returns a sorted list of labels of neighbors for a given source node.
        Needed for canonical prime assignment.
        """
        if not self.graph or not self.graph.graph or source_node_label not in self.graph.graph:
            return []
        try:
            neighbor_labels = sorted(list(self.graph.graph.neighbors(source_node_label)))
            return neighbor_labels
        except Exception as e:
            print(f"Error getting sorted neighbors for {source_node_label}: {e}")
            return []

    def get_canonical_edge_prime(self, source_node_label: str, target_node_label: str) -> Optional[gmpy2.mpz]:
        """
        Gets the canonical prime number for an edge based on a stable ordering.
        Strategy: Sort target node labels alphabetically/numerically from source.
        """
        from services.path_encoding_service import get_nth_prime_gmpy
        neighbor_labels = self.get_sorted_neighbor_labels(source_node_label)
        if not neighbor_labels:
            print(f"Warning: Node {source_node_label} has no neighbors or does not exist in graph.")
            return None
        if target_node_label not in neighbor_labels:
            print(f"Warning: Target {target_node_label} not a neighbor of {source_node_label}.")
            return None
        try:
            prime_order_index = neighbor_labels.index(target_node_label) + 1
            return get_nth_prime_gmpy(prime_order_index)
        except ValueError:
            print(f"Error: Target {target_node_label} was in neighbor_labels but index failed (should not happen).")
            return None
        except Exception as e:
            print(f"Error getting canonical edge prime for ({source_node_label} -> {target_node_label}): {e}")
            return None

    def find_path(self, start_node_label: str, end_node_label: str) -> Optional[List[str]]:
        """
        Finds a path (list of node labels) between two nodes using BFS (NetworkX shortest_path).
        """
        if not self.graph or not self.graph.graph:
            print("Error: Graph not initialized in KnowledgeGraphService.")
            return None
        if start_node_label not in self.graph.graph or end_node_label not in self.graph.graph:
            print(f"Error: Start ({start_node_label}) or End ({end_node_label}) node not in graph.")
            return None
        try:
            import networkx as nx
            path_nodes = nx.shortest_path(self.graph.graph, source=start_node_label, target=end_node_label)
            return path_nodes
        except nx.NetworkXNoPath:
            print(f"No path found between {start_node_label} and {end_node_label}.")
            return None
        except Exception as e:
            print(f"Error finding path between {start_node_label} and {end_node_label}: {e}")
            return None

    # Placeholder for SuperToken logic
    def register_super_token_for_path(self, path_node_labels: List[str], claim: str):
        print(f"Placeholder: Registering SuperToken for path {path_node_labels} with claim '{claim}'.")
        # 1. Get edge primes for the path
        # 2. Encode path
        # 3. Create and store SuperToken
        pass

    def get_node_degree(self, node_label: str) -> int:
        """
        Returns the degree (number of connections) of the given node label in the graph.
        """
        if not self.graph or not self.graph.graph:
            return 0
        if node_label not in self.graph.graph:
            return 0
        try:
            return self.graph.graph.degree[node_label]
        except Exception as e:
            print(f"Error getting degree for node {node_label}: {e}")
            return 0 