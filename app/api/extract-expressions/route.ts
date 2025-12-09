import { NextRequest, NextResponse } from 'next/server'

interface UsefulExpression {
  phrase: string
  meaning: string
  example: string
}

interface ExpressionRequest {
  transcript: string
  aiProvider: 'openai' | 'azure-openai'
  openaiKey?: string
  openaiModel?: string
  azureOpenaiKey?: string
  azureOpenaiEndpoint?: string
  azureOpenaiDeployment?: string
}

export async function POST(req: NextRequest) {
  try {
    const body: ExpressionRequest = await req.json()

    const {
      transcript,
      aiProvider,
      openaiKey,
      openaiModel = 'gpt-5-mini',
      azureOpenaiKey,
      azureOpenaiEndpoint,
      azureOpenaiDeployment,
    } = body

    if (!transcript || !transcript.trim()) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 })
    }

    if (!aiProvider) {
      return NextResponse.json({ error: 'AI provider is required' }, { status: 400 })
    }

    const systemPrompt = `You are an expert language teacher. 
Analyze the provided transcript and extract 5-8 useful, practical expressions that would be valuable for intermediate (CEFR B1-B2 equivalent) learners of the language in the transcript.

Focus on:
- Idiomatic phrases and common expressions
- Phrasal verbs / multi-word verbs
- Collocations (word combinations)
- Conversational patterns
- Useful vocabulary in context

For each expression, provide:
1. The exact phrase from the transcript
2. A clear, simple explanation (for intermediate learner)
3. A practical example showing usage

Return ONLY a valid JSON array with no markdown formatting. Each object must have: phrase, meaning, example.
Example format:
[{"phrase":"expression here","meaning":"simple explanation","example":"example sentence"}]`

    const userPrompt = `Here is the podcast transcript:\n\n${transcript}\n\nExtract useful expressions for intermediate learners.`

    let response

    if (aiProvider === 'openai') {
      if (!openaiKey) {
        return NextResponse.json(
          { error: 'OpenAI API key is required' },
          { status: 400 }
        )
      }

      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: openaiModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_completion_tokens: 4000,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('[OpenAI API Error]', { status: response.status, error })
        return NextResponse.json(
          { error: 'Failed to extract expressions from OpenAI', details: error },
          { status: response.status }
        )
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        return NextResponse.json(
          { error: 'No response from OpenAI' },
          { status: 500 }
        )
      }

      // Parse JSON from response
      const expressions = parseExpressions(content)
      return NextResponse.json({ expressions })
    } else if (aiProvider === 'azure-openai') {
      if (!azureOpenaiKey || !azureOpenaiEndpoint || !azureOpenaiDeployment) {
        return NextResponse.json(
          { error: 'Azure OpenAI credentials are required' },
          { status: 400 }
        )
      }

      const endpoint = azureOpenaiEndpoint.endsWith('/') 
        ? azureOpenaiEndpoint 
        : azureOpenaiEndpoint + '/'
      
      const url = `${endpoint}openai/deployments/${azureOpenaiDeployment}/chat/completions?api-version=2024-10-01-preview`

      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': azureOpenaiKey,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_completion_tokens: 4000,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('[Azure OpenAI API Error]', error)
        return NextResponse.json(
          { error: 'Failed to extract expressions from Azure OpenAI', details: error },
          { status: response.status }
        )
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        // console.error('[Azure OpenAI No Content]', { 
        //   status: response.status,
        //   dataKeys: Object.keys(data),
        //   choicesLength: data.choices?.length,
        //   firstChoice: data.choices?.[0],
        //   fullResponse: JSON.stringify(data, null, 2)
        // })
        return NextResponse.json(
          { error: 'No response from Azure OpenAI', details: { dataKeys: Object.keys(data), firstChoice: data.choices?.[0] } },
          { status: 500 }
        )
      }

      // Parse JSON from response
      const expressions = parseExpressions(content)
      return NextResponse.json({ expressions })
    } else {
      return NextResponse.json(
        { error: 'Invalid AI provider' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[Extract Expressions Error]', error)
    return NextResponse.json(
      { error: 'Failed to extract expressions', details: String(error) },
      { status: 500 }
    )
  }
}

function parseExpressions(content: string): UsefulExpression[] {
  try {
    // Try to extract JSON array from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      // Validate structure
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item: unknown): item is UsefulExpression =>
            typeof item === 'object' &&
            item !== null &&
            'phrase' in item &&
            'meaning' in item &&
            'example' in item &&
            typeof (item as Record<string, unknown>).phrase === 'string' &&
            typeof (item as Record<string, unknown>).meaning === 'string' &&
            typeof (item as Record<string, unknown>).example === 'string'
        )
      }
    }
    return []
  } catch (error) {
    console.error('[Parse Expressions Error]', error)
    return []
  }
}
