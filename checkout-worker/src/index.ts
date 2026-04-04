interface CheckoutRequest {
  product_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: {
    number: string;
    country_code: string;
  };
  plan_id?: string;
  plan_slug?: string;
  plan_title?: string;
  redirect_url?: string;
}

interface ChariowCheckoutResponse {
  message: string;
  data: {
    step: 'payment' | 'completed' | 'already_purchased';
    purchase?: {
      id: string;
      status: string;
      amount?: {
        value: number;
        formatted: string;
        short: string;
        currency: string;
      };
    };
    payment?: {
      checkout_url: string;
      transaction_id: string;
    };
    message?: string;
  };
  errors: Record<string, string[]>;
}

const CHARIOW_API_URL = 'https://api.chariow.com/v1';

export default {
  async fetch(request: Request): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only accept POST
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const body: CheckoutRequest = await request.json();

      // Validate required fields
      const required = ['product_id', 'email', 'first_name', 'last_name', 'phone'];
      for (const field of required) {
        if (field === 'phone') {
          if (!body.phone?.number || !body.phone?.country_code) {
            return new Response(
              JSON.stringify({ error: `phone.number and phone.country_code are required` }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else if (!body[field as keyof CheckoutRequest]) {
          return new Response(
            JSON.stringify({ error: `${field} is required` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return new Response(
          JSON.stringify({ error: 'Invalid email format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Build redirect URL with plan info
      let redirectUrl = body.redirect_url;
      if (!redirectUrl && body.plan_slug) {
        redirectUrl = `https://shop.wooplans.com/merci?plan=${body.plan_slug}`;
      }

      // Prepare metadata
      const custom_metadata: Record<string, string> = {};
      if (body.plan_id) custom_metadata.plan_id = body.plan_id;
      if (body.plan_slug) custom_metadata.plan_slug = body.plan_slug;
      if (body.plan_title) custom_metadata.plan_title = body.plan_title;

      // Call Chariow API
      const apiKey = typeof CHARIOW_API_KEY !== 'undefined' ? CHARIOW_API_KEY : '';
      if (!apiKey) {
        console.error('CHARIOW_API_KEY is not set');
        return new Response(
          JSON.stringify({ error: 'Checkout service not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const chariowPayload: Record<string, unknown> = {
        product_id: body.product_id,
        email: body.email,
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone,
      };

      if (redirectUrl) chariowPayload.redirect_url = redirectUrl;
      if (Object.keys(custom_metadata).length > 0) chariowPayload.custom_metadata = custom_metadata;

      const chariowResponse = await fetch(`${CHARIOW_API_URL}/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chariowPayload),
      });

      const chariowData: ChariowCheckoutResponse = await chariowResponse.json();

      if (chariowData.errors && Object.keys(chariowData.errors).length > 0) {
        return new Response(
          JSON.stringify({ 
            error: 'Validation failed', 
            errors: chariowData.errors,
            message: chariowData.message 
          }),
          { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (chariowData.data.step === 'payment' && chariowData.data.payment?.checkout_url) {
        return new Response(
          JSON.stringify({ 
            checkout_url: chariowData.data.payment.checkout_url,
            purchase_id: chariowData.data.purchase?.id,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (chariowData.data.step === 'completed') {
        return new Response(
          JSON.stringify({ 
            completed: true,
            purchase_id: chariowData.data.purchase?.id,
            message: 'Purchase completed'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (chariowData.data.step === 'already_purchased') {
        return new Response(
          JSON.stringify({ 
            error: 'already_purchased',
            message: chariowData.data.message || 'You have already purchased this product'
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Unexpected response from payment provider' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error('Checkout error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
};
