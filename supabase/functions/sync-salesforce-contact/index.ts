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

    // 1. Fetch Salesforce token for this tenant
    const { data: integration, error } = await supabase
      .from('crm_integrations')
      .select('access_token, is_active')
      .eq('tenant_id', tenantId)
      .eq('provider', 'salesforce')
      .single()

    if (error || !integration?.is_active || !integration?.access_token) {
      console.log(`Salesforce sync skipped for tenant ${tenantId}. Integration inactive or not found.`)
      return new Response(JSON.stringify({ message: "No active Salesforce integration found." }), { headers: { "Content-Type": "application/json" } })
    }

    // 2. Map payload to Salesforce Contact format
    let firstname = record.name || ""
    let lastname = "Unknown" // Salesforce requires a LastName
    const nameParts = firstname.split(" ")
    if (nameParts.length > 1) {
      firstname = nameParts[0]
      lastname = nameParts.slice(1).join(" ")
    } else if (firstname) {
      lastname = firstname
      firstname = ""
    }

    const sfPayload = {
      Phone: record.phone_number,
      FirstName: firstname,
      LastName: lastname,
      Description: `[WhatsApp Tags: ${(record.tags || []).join(", ")}] ${record.notes || ""}`
    }

    // Since Salesforce is more complex and requires knowing the instance URL, 
    // a production implementation would store the `instance_url` alongside the `access_token`.
    // For V1 Ponytail method, we assume the user provides their instance URL in the token field separated by a pipe `|` 
    // e.g. "https://my-domain.my.salesforce.com|00D123..." or we just hit a hardcoded demo domain for now.
    // Let's parse it if they provide it via a pipe, otherwise fail.
    
    const parts = integration.access_token.split('|')
    if (parts.length < 2) {
      throw new Error("Salesforce access_token must be formatted as 'INSTANCE_URL|ACCESS_TOKEN'")
    }
    
    const instanceUrl = parts[0]
    const token = parts[1]

    const sfRes = await fetch(`${instanceUrl}/services/data/v58.0/sobjects/Contact`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(sfPayload)
    })

    if (!sfRes.ok) {
      const errText = await sfRes.text()
      console.error(`Salesforce API error: ${sfRes.status} ${errText}`)
      throw new Error(`Salesforce API Error: ${errText}`)
    }

    const sfData = await sfRes.json()

    return new Response(JSON.stringify({ success: true, salesforce_contact_id: sfData.id }), { headers: { "Content-Type": "application/json" } })

  } catch (error: any) {
    console.error('Error syncing to Salesforce:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})
