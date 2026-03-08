import axios from 'axios';
import { config } from '../config';

export class AIService {
  // Groq: free, fast, 14400 req/day with llama-3.1-8b-instant
  private static readonly API_URL = 'https://api.groq.com/openai/v1/chat/completions';
  private static readonly MODEL = 'llama-3.1-8b-instant';

  private static getSystemPrompt(context: string): string {
    return `Tu es l'assistant IA de WorkKnock, une plateforme de gestion freelance.
Tu parles en français. Tu es concis et utile.

CONTEXTE UTILISATEUR:
${context}

TU PEUX EFFECTUER CES ACTIONS (réponds avec un JSON action si nécessaire):

1. CRÉER UNE FACTURE:
{"action": "create_invoice", "data": {"clientName": "...", "items": [{"description": "...", "quantity": 1, "unitPrice": 500}], "taxRate": 20, "discount": 0, "issueDate": "YYYY-MM-DD", "dueDate": "YYYY-MM-DD", "notes": "..."}}

2. LISTER LES FACTURES:
{"action": "list_invoices", "data": {"status": "ALL|DRAFT|SENT|PAID|OVERDUE", "clientName": ""}}

3. OBTENIR LE CA:
{"action": "get_revenue", "data": {"year": 2026}}

4. LISTER LES IMPAYÉS:
{"action": "list_unpaid"}

5. CRÉER UN CLIENT:
{"action": "create_client", "data": {"name": "...", "email": "...", "phone": "...", "address": "...", "city": "...", "postalCode": "...", "siret": "..."}}

6. SOLDE CONGÉS:
{"action": "get_leaves"}

7. LISTER LES CLIENTS:
{"action": "list_clients"}

8. CRÉER UNE NOTE DE FRAIS:
{"action": "create_expense", "data": {"title": "...", "items": [{"date": "YYYY-MM-DD", "category": "TRANSPORT|REPAS|HEBERGEMENT|MATERIEL|LOGICIEL|TELEPHONE|FORMATION|AUTRE", "description": "...", "amount": 50, "merchant": "..."}]}}

9. MARQUER FACTURE PAYÉE:
{"action": "mark_paid", "data": {"invoiceNumber": "FAC-001", "amount": 1000, "method": "virement"}}

10. ENVOYER UNE FACTURE:
{"action": "send_invoice", "data": {"invoiceNumber": "FAC-001"}}

11. CRÉER UN CONGÉ:
{"action": "create_leave", "data": {"type": "CP|RTT|MALADIE|SANS_SOLDE", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "days": 5, "reason": "Vacances"}}

12. OBTENIR LE PDF D'UNE FACTURE:
{"action": "get_invoice_pdf", "data": {"invoiceNumber": "FAC-001"}}

13. OBTENIR LE PDF D'UNE NOTE DE FRAIS:
{"action": "get_expense_pdf", "data": {"title": "Frais 3/2026"}}

RÈGLES ABSOLUES - TRÈS IMPORTANT:
- QUAND UNE ACTION EST NÉCESSAIRE: ta réponse ENTIÈRE doit être SEULEMENT le JSON. RIEN avant, RIEN après. Pas de "Voici", pas d'explication, pas de backticks, pas de markdown.
- EXEMPLE CORRECT: {"action": "list_invoices", "data": {"status": "ALL"}}
- EXEMPLE INCORRECT: Voici la commande: {"action": "list_invoices", "data": {"status": "ALL"}}
- EXEMPLE INCORRECT: \`\`\`json{"action": ...}\`\`\`
- Ta réponse doit commencer par { et finir par } quand c'est une action
- Si l'utilisateur pose une question sans action, réponds en texte avec des emojis WhatsApp
- Pour les dates: YYYY-MM-DD. Date actuelle: ${new Date().toISOString().split('T')[0]}
- Si des infos manquent, demande-les EN TEXTE (pas de JSON)
- Montants en EUR
- Remise en %: calcule le prix unitaire après remise
- "le mois dernier" = calcule la date, "client Dupont" = cherche par nom
- dueDate par défaut = 30 jours après issueDate
- issueDate par défaut = aujourd'hui
- RAPPEL FINAL: pour une action → JSON PUR, rien d'autre.`;
  }

  static async chat(userMessage: string, context: string): Promise<string> {
    const apiKey = config.ai.groqApiKey || config.ai.geminiApiKey;
    if (!apiKey) {
      return '❌ IA non configurée. Ajoutez GROQ_API_KEY dans les variables d\'environnement.';
    }

    try {
      const systemPrompt = AIService.getSystemPrompt(context);

      const response = await axios.post(
        AIService.API_URL,
        {
          model: AIService.MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.3,
          max_tokens: 1024,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const text = response.data?.choices?.[0]?.message?.content;
      if (!text) return '❌ Pas de réponse de l\'IA.';
      console.log('[AI] ✅ Groq response received');
      return text.trim();
    } catch (err: any) {
      console.error('[AI] Groq error:', err?.response?.data || err.message);
      if (err?.response?.status === 429) {
        return '⏳ Trop de requêtes. Réessayez dans quelques secondes.';
      }
      return '❌ Erreur IA. Réessayez.';
    }
  }

  static isAction(response: string): boolean {
    const json = AIService.extractJson(response);
    if (!json) return false;
    try {
      const parsed = JSON.parse(json);
      return !!parsed.action;
    } catch {
      return false;
    }
  }

  static parseAction(response: string): { action: string; data: any } | null {
    const json = AIService.extractJson(response);
    if (!json) {
      console.log('[AI] ⚠️ extractJson returned null for:', response.substring(0, 300));
      return null;
    }
    try {
      const parsed = JSON.parse(json);
      if (!parsed.action) {
        console.log('[AI] ⚠️ No action field in parsed JSON');
        return null;
      }
      console.log('[AI] ✅ Parsed action:', parsed.action, 'data:', JSON.stringify(parsed.data));
      return { action: parsed.action, data: parsed.data || {} };
    } catch (e) {
      console.log('[AI] ⚠️ JSON.parse failed:', e);
      return null;
    }
  }

  // Extract JSON from AI response - handles all common LLM output formats
  private static extractJson(response: string): string | null {
    const trimmed = response.trim();

    // Strategy 1: Direct parse (cleanest case)
    try { const p = JSON.parse(trimmed); if (p.action) return trimmed; } catch {}

    // Strategy 2: Remove markdown code fences
    const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) {
      try { const p = JSON.parse(codeBlock[1].trim()); if (p.action) return codeBlock[1].trim(); } catch {}
    }

    // Strategy 3: Find {"action":...} with balanced brace matching
    const actionIdx = trimmed.indexOf('"action"');
    if (actionIdx !== -1) {
      // Find the opening { before "action"
      let startIdx = trimmed.lastIndexOf('{', actionIdx);
      if (startIdx !== -1) {
        const balanced = AIService.findBalancedJson(trimmed, startIdx);
        if (balanced) {
          try { const p = JSON.parse(balanced); if (p.action) return balanced; } catch {}
        }
      }
    }

    // Strategy 4: Any JSON object
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === '{') {
        const balanced = AIService.findBalancedJson(trimmed, i);
        if (balanced) {
          try { const p = JSON.parse(balanced); if (p.action) return balanced; } catch {}
        }
      }
    }

    console.log('[AI] ⚠️ No JSON found in:', trimmed.substring(0, 300));
    return null;
  }

  // Find balanced JSON starting from position `start`
  private static findBalancedJson(str: string, start: number): string | null {
    if (str[start] !== '{') return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < str.length; i++) {
      const c = str[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"' && !esc) { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') depth++;
      if (c === '}') {
        depth--;
        if (depth === 0) return str.substring(start, i + 1);
      }
    }
    return null;
  }
}
