import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {    // Parse request body
    const data = await req.json();
    const { name, role, address, signature, message, chainId, tempToken } = data;
    
    console.log('Processing wallet registration:', { 
      name, 
      role, 
      address,
      messagePreview: message ? message.substring(0, 20) + '...' : 'none',
      chainId,
      hasTempToken: !!tempToken
    });
    
    // Validate required fields - allow tempToken as alternative to signature/message
    if (!name || !role || !address || (!signature && !tempToken) || (!message && !tempToken)) {
      console.error('Missing required fields:', {
        name: !!name,
        role: !!role,
        address: !!address,
        signature: !!signature,
        message: !!message,
        tempToken: !!tempToken
      });
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Forward the request to the backend API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5010/api';
    console.log(`Connecting to backend API: ${apiUrl}/auth/web3/register`);
    
    try {      const response = await fetch(`${apiUrl}/auth/web3/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          role,
          address,
          signature,
          message,
          chainId,
          tempToken
        }),
      });
      
      // Check if the response was received
      if (!response) {
        console.error('No response received from backend');
        return NextResponse.json(
          { success: false, message: 'No response from server' },
          { status: 502 }
        );
      }
      
      // Parse the response
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        return NextResponse.json(
          { success: false, message: 'Invalid response from server' },
          { status: 502 }
        );
      }
      
      console.log('Backend response:', {
        status: response.status,
        success: result.success,
        message: result.message
      });
      
      // Return the result
      return NextResponse.json(result, { status: response.status });
    } catch (fetchError) {
      console.error('Fetch error during wallet registration:', fetchError);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Error connecting to server',
          details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Error in register-wallet API route:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'An error occurred during wallet registration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 