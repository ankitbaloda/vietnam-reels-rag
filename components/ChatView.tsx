const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;
    if (isStreaming || isLoading) { 
      setQueuedPrompt(inputValue.trim()); 
      return; 
    }

    const userMessage = inputValue.trim();
    setInputValue('');
    setError(null);

    const userMsg: Message = { id: generateId(), role: 'user', content: userMessage, ts: Date.now(), step: currentStep };
    onSendMessage(userMsg.content, selectedModel, 'user');
    setLastUserMessage(userMsg.content);

   
    try {
     setIsGeneratingResponse(true);
      setIsStreaming(true);
     const response = ragEnabled
       ? await sendRAGQuery({ query: prompt, model: selectedModel, top_k: topK, temperature, session_id: sessionId, step: currentStep })
       : await sendChatMessage({
           model: selectedModel,
           messages: [
             { role: 'system', content: systemForStep(currentStep) },
             ...messages.filter(m => m.role !== 'assistant').map(m => ({ role: m.role, content: m.content })),
             { role: 'user', content: prompt }
           ] as any,
           temperature,
           session_id: sessionId,
           step: currentStep,
         });

     const finalText = response.choices[0]?.message?.content || 'No response';
     const citations = ragEnabled ? (response as RAGResponse).citations : undefined;
     
     onSendMessage(finalText, selectedModel, 'assistant', citations);
     setVariants(v => [...v, { id: generateId(), content: finalText, model: selectedModel }]);
     setActivity('');
     setIsGeneratingResponse(true);
     
     const response2 = ragEnabled
       ? await sendRAGQuery({ query: userMessage, model: selectedModel, top_k: topK, temperature, session_id: sessionId, step: currentStep })
       : await sendChatMessage({
           model: selectedModel,
           messages: [
             { role: 'system', content: systemForStep(currentStep) },
             ...[...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
           ] as any,
           temperature,
           session_id: sessionId,
           step: currentStep,
         });

     const finalText2 = response2.choices[0]?.message?.content || 'No response';
     const citations2 = ragEnabled ? (response2 as RAGResponse).citations : undefined;
     
     onSendMessage(finalText2, selectedModel, 'assistant', citations2);
     setVariants(v => [...v, { id: generateId(), content: finalText2, model: selectedModel }]);
      setIsStreaming(true);
      const url = ragEnabled ? '/api/rag/chat/stream' : '/api/chat/stream';
      const body = ragEnabled
        ? { query: prompt, model: selectedModel, top_k: topK, temperature, session_id: sessionId, step: currentStep }
        : { model: selectedModel, messages: [ { role: 'system', content: systemForStep(currentStep) }, ...messages.filter(m => m.role !== 'assistant').map(m => ({ role: m.role, content: m.content })), { role: 'user', content: prompt } ], temperature, session_id: sessionId, step: currentStep };
      startStream(url, body, (finalText) => {
        onSendMessage(finalText, selectedModel, 'assistant', streamCitations);
        setVariants(v => [...v, { id: generateId(), content: finalText, model: selectedModel }]);
      });
       if (response.usage && onUsageUpdate) {
      const url2 = ragEnabled ? '/api/rag/chat/stream' : '/api/chat/stream';
      const body2 = ragEnabled
        ? { query: userMessage, model: selectedModel, top_k: topK, temperature, session_id: sessionId, step: currentStep }
        : { model: selectedModel, messages: [ { role: 'system', content: systemForStep(currentStep) }, ...messages.filter(m => m.role !== 'assistant').map(m => ({ role: m.role, content: m.content })), { role: 'user', content: userMessage } ], temperature, session_id: sessionId, step: currentStep };
      }
      setIsStreaming(false);
    } catch (error) {
      setError('An error occurred');
      setIsStreaming(false);
    }
  };

export default handleSubmit;