@@ .. @@
   const handleSubmit = async (e?: React.FormEvent) => {
     if (e) e.preventDefault();
     if (!inputValue.trim()) return;
-    if (isStreaming) { setQueuedPrompt(inputValue.trim()); return; }
+    if (isStreaming || isLoading) { 
+      setQueuedPrompt(inputValue.trim()); 
+      return; 
+    }

     const userMessage = inputValue.trim();
     setInputValue('');
     setError(null);

     const userMsg: Message = { id: generateId(), role: 'user', content: userMessage, ts: Date.now(), step: currentStep };
     onSendMessage(userMsg.content, selectedModel, 'user');
     setLastUserMessage(userMsg.content);

     try {
-      setActivity('Thinking…');
-      setIsStreaming(true);
-      const url = ragEnabled ? '/api/rag/chat/stream' : '/api/chat/stream';
-      const body = ragEnabled
-        ? { query: userMessage, model: selectedModel, top_k: topK, temperature, session_id: sessionId, step: currentStep }
-        : { model: selectedModel, messages: [ { role: 'system', content: systemForStep(currentStep) }, ...[...messages, userMsg].map(m => ({ role: m.role, content: m.content })) ], temperature, session_id: sessionId, step: currentStep };
-      startStream(url, body, (finalText) => {
-        onSendMessage(finalText, selectedModel, 'assistant', streamCitations);
-        setVariants(v => [...v, { id: generateId(), content: finalText, model: selectedModel }]);
-      });
+      setActivity('Processing with RAG system...');
+      setIsStreaming(true);
+      
+      // Use appropriate API based on RAG toggle
+      if (ragEnabled) {
+        const response = await sendRAGQuery({
+          query: userMessage,
+          model: selectedModel,
+          top_k: topK,
+          temperature,
+          session_id: sessionId,
+          step: currentStep,
+        });
+        
+        const content = response.choices[0]?.message?.content || 'No response generated';
+        const citations = response.citations || [];
+        
+        onSendMessage(content, selectedModel, 'assistant', citations);
+        setVariants(v => [...v, { id: generateId(), content, model: selectedModel }]);
+        
+        // Update usage if available
+        if (response.usage && onUsageUpdate) {
+          onUsageUpdate({
+            promptTokens: response.usage.prompt_tokens,
+            completionTokens: response.usage.completion_tokens,
+          });
+        }
+      } else {
+        const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
+        const systemMessage = { role: 'system', content: systemForStep(currentStep) };
          if (ragEnabled) {
            const resp = await sendRAGQuery({ 
              query: userMessage, 
              model: mId, 
              top_k: topK, 
              temperature, 
              session_id: sessionId, 
              step: currentStep 
            });
            return { content: resp.choices[0]?.message?.content || 'No response', citations: resp.citations };
          } else {
            const resp = await sendChatMessage({
+          messages: [systemMessage, ...allMessages],
                messages: [
                  { role: 'system', content: systemForStep(currentStep) },
                  ...messages.map(m => ({ role: m.role, content: m.content })),
                  { role: 'user', content: userMessage },
                ],
+        const content = response.choices[0]?.message?.content || 'No response generated';
+        
+        onSendMessage(content, selectedModel, 'assistant');
            });
            return { content: resp.choices[0]?.message?.content || 'No response', citations: undefined };
          }
+        // Update usage if available
+        if (response.usage && onUsageUpdate) {
+          onUsageUpdate({
+            promptTokens: response.usage.prompt_tokens,
+            completionTokens: response.usage.completion_tokens,
+          });
+        }
+      }
     } catch (err) {
       console.error('Chat error:', err);
       const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
       setError(errorMessage);
-      setIsStreaming(false);
     } finally {
+      setIsStreaming(false);
+      setActivity('');
       if (!isStreaming && queuedPrompt) { 
         const qp = queuedPrompt; 
         setQueuedPrompt(null); 
         setInputValue(qp); 
         Promise.resolve().then(() => handleSubmit()); 
       }
     }
   };