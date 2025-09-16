#!/usr/bin/env python3
"""Simple script to add test data to Qdrant for testing RAG functionality."""

import os
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct
import random

def create_test_embeddings(size=3072):
    """Create random embeddings for testing."""
    return [random.random() for _ in range(size)]

def populate_test_data():
    """Add test travel content to Qdrant."""
    # Connect to Qdrant
    qc = QdrantClient(url="http://localhost:6333")
    
    # Test documents
    test_docs = [
        {
            "text": "Vietnam travel tips: Always try the local pho and banh mi. The best food is found in street vendors, not fancy restaurants. Bring cash as many places don't accept cards.",
            "source": "Vietnam_Travel_Tips.txt",
            "topic": "food"
        },
        {
            "text": "Creating viral travel reels: Use dynamic camera movements, show authentic local experiences, include food shots, and tell a story within 30 seconds. Golden hour lighting is essential.",
            "source": "Master_Viral_Travel_Reels_Playbook.txt", 
            "topic": "content_creation"
        },
        {
            "text": "Vietnam day 1 itinerary: Land in Ho Chi Minh City, check into District 1 hotel, explore Ben Thanh Market, try street food tour, visit Saigon Opera House in evening.",
            "source": "Vietnam_Daywise_Narrations_Transcripts.txt",
            "topic": "itinerary"
        },
        {
            "text": "Budget breakdown for Vietnam trip: Accommodation $30/day, food $15/day, transport $20/day, activities $25/day. Total budget approximately $90 per day for mid-range travel.",
            "source": "vietnam_trip_costs.csv",
            "topic": "budget"
        },
        {
            "text": "Hanoi old quarter exploration: Navigate narrow streets, visit Hoan Kiem Lake, try egg coffee, explore weekend night market. Best visited early morning or late evening to avoid crowds.",
            "source": "Vietnam_Travel_Guide.txt",
            "topic": "destinations"
        }
    ]
    
    # Create points
    points = []
    for i, doc in enumerate(test_docs):
        point = PointStruct(
            id=i + 1,
            vector=create_test_embeddings(),
            payload={
                "text": doc["text"],
                "source_name": doc["source"],
                "file_path": f"data/source/{doc['source']}",
                "topic": doc["topic"],
                "chunk_index": 0
            }
        )
        points.append(point)
    
    # Insert points
    try:
        qc.upsert(
            collection_name="flowise_reels",
            points=points
        )
        print(f"Successfully added {len(points)} test documents to Qdrant")
        
        # Verify
        collection_info = qc.get_collection("flowise_reels")
        print(f"Collection now has {collection_info.points_count} points")
        
    except Exception as e:
        print(f"Error inserting points: {e}")

if __name__ == "__main__":
    populate_test_data()