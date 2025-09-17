#!/usr/bin/env python3
"""
Test the complete Vietnam Reels RAG workflow end-to-end
"""
import requests
import json
import time

BASE_URL = "http://localhost:3001"

def test_workflow():
    print("🧪 Testing Vietnam Reels RAG Workflow End-to-End")
    print("=" * 60)
    
    # Test 1: Models endpoint
    print("\n1. Testing Models Endpoint...")
    response = requests.get(f"{BASE_URL}/api/models")
    if response.status_code == 200:
        models = response.json()
        print(f"   ✅ Found {len(models)} models available")
    else:
        print(f"   ❌ Models endpoint failed: {response.status_code}")
        return
    
    # Test 2: RAG Chat Stream - Ideation
    print("\n2. Testing RAG Chat Stream - Ideation Step...")
    payload = {
        "query": "Create 3 viral Vietnam travel reel ideas using our actual Phu Quoc and Ninh Binh footage",
        "model": "openai/gpt-4o-mini",
        "session_id": "workflow_test",
        "step": "ideation"
    }
    
    response = requests.post(f"{BASE_URL}/api/rag/chat/stream", 
                           json=payload, 
                           stream=True)
    
    if response.status_code == 200:
        citations_found = False
        tokens_found = False
        content_chunks = []
        
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data: '):
                    try:
                        data = json.loads(line_str[6:])
                        
                        # Check for citations
                        if 'citations' in data:
                            citations_found = True
                            print(f"   ✅ Citations found: {len(data['citations'])} sources")
                            
                        # Check for content
                        if 'delta' in data:
                            content_chunks.append(data['delta'])
                            
                        # Check for usage tokens
                        if 'context_tokens' in data:
                            tokens_found = True
                            print(f"   ✅ Context tokens: {data['context_tokens']}")
                            print(f"   ✅ RAG enabled: {data.get('rag_enabled', False)}")
                            
                    except json.JSONDecodeError:
                        continue
                        
        full_content = ''.join(content_chunks)
        
        if citations_found and tokens_found and len(full_content) > 100:
            print("   ✅ RAG Ideation Step - WORKING")
            print(f"   📝 Generated {len(full_content)} characters of content")
        else:
            print("   ❌ RAG Ideation Step - Missing components")
            
    else:
        print(f"   ❌ RAG Chat Stream failed: {response.status_code}")
        return
    
    # Test 3: Non-RAG Chat Stream
    print("\n3. Testing Non-RAG Chat Stream...")
    payload = {
        "query": "What is the capital of France?",
        "model": "openai/gpt-4o-mini",
        "session_id": "workflow_test"
    }
    
    response = requests.post(f"{BASE_URL}/api/chat/stream", 
                           json=payload, 
                           stream=True)
    
    if response.status_code == 200:
        tokens_found = False
        content_chunks = []
        
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data: '):
                    try:
                        data = json.loads(line_str[6:])
                        
                        # Check for content
                        if 'delta' in data:
                            content_chunks.append(data['delta'])
                            
                        # Check for usage tokens
                        if 'completion_tokens' in data:
                            tokens_found = True
                            print(f"   ✅ Completion tokens: {data['completion_tokens']}")
                            print(f"   ✅ RAG enabled: {data.get('rag_enabled', False)}")
                            
                    except json.JSONDecodeError:
                        continue
                        
        full_content = ''.join(content_chunks)
        
        if tokens_found and len(full_content) > 10:
            print("   ✅ Non-RAG Chat Stream - WORKING")
        else:
            print("   ❌ Non-RAG Chat Stream - Missing components")
            
    else:
        print(f"   ❌ Non-RAG Chat Stream failed: {response.status_code}")
        
    # Test 4: Chat History
    print("\n4. Testing Chat History...")
    response = requests.get(f"{BASE_URL}/api/history/workflow_test")
    if response.status_code == 200:
        history = response.json()
        print(f"   ✅ Chat history retrieved: {len(history)} messages")
    else:
        print(f"   ❌ Chat history failed: {response.status_code}")
    
    print("\n" + "=" * 60)
    print("🎉 Workflow test completed!")

if __name__ == "__main__":
    test_workflow()