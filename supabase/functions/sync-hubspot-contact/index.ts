import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

serve(async (req) => {
  try {
    const payload = await req.json()
    const { record, type } = payload // 'record' is the contacts row from Postgres Webhook

    if (type !== 'INSERT' && type !== 'UPDATE') {
      return new Response(JSON.stringify({ message: "Ignored event type" }), { headers: { "Content-Type": "application/json" } })
    }

    const tenantId = record.tenant_id
    if (!tenantId) throw new Error("No tenant_id in record")

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch HubSpot token for this tenant
    const { data: integration, error } = await supabase
      .from('crm_integrations')
      .select('access_token, is_active')
      .eq('tenant_id', tenantId)
      .eq('provider', 'hubspot')
      .single()

    if (error || !integration?.is_active || !integration?.access_token) {
      console.log(`HubSpot sync skipped for tenant ${tenantId}. Integration inactive or not found.`)
      return new Response(JSON.stringify({ message: "No active HubSpot integration found." }), { headers: { "Content-Type": "application/json" } })
    }

    // 2. Map payload to HubSpot Contact format
    // Hubspot's contact unique identifier for searching/upserting is usually email, but since we rely on phone number,
    // we'll use HubSpot's search API first or simply create/update based on phone.
    // For simplicity, HubSpot CRM has a "search by phone" endpoint or we can use the normal contacts endpoint.
    // The bare minimum is creating a contact.
    
    // Split name into firstname and lastname if possible
    let firstname = record.name || ""
    let lastname = ""
    const nameParts = firstname.split(" ")
    if (nameParts.length > 1) {
      firstname = nameParts[0]
      lastname = nameParts.slice(1).join(" ")
    }

    const hubspotPayload = {
      properties: {
        phone: record.phone_number,
        firstname: firstname,
        lastname: lastname,
        whatsapp_tags: (record.tags || []).join(", "),
        whatsapp_notes: record.notes || ""
      }
    }

    // Since we don't have HubSpot's Contact ID, a simple approach is to use the Contacts v3 API to search by phone,
    // but without an email, upserting in HubSpot requires a custom unique property or search-then-patch.
    // Let's implement a direct create for this prototype (v1). If it errors due to duplicate, we can ignore or log.
    
    const hsRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${integration.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(hubspotPayload)
    })

    if (!hsRes.ok) {
      const errText = await hsRes.text()
      // If it's a 409 Conflict, it means the contact exists. We could catch this and run a PATCH if needed, 
      // but for V1 we'll just log it.
      console.error(`HubSpot API error: ${hsRes.status} ${errText}`)
      if (hsRes.status === 409) {
        return new Response(JSON.stringify({ message: "Contact already exists in HubSpot" }), { headers: { "Content-Type": "application/json" } })
      }
      throw new Error(`HubSpot API Error: ${errText}`)
    }

    const hsData = await hsRes.json()

    return new Response(JSON.stringify({ success: true, hubspot_contact_id: hsData.id }), { headers: { "Content-Type": "application/json" } })

  } catch (error: any) {
    console.error('Error syncing to HubSpot:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})
