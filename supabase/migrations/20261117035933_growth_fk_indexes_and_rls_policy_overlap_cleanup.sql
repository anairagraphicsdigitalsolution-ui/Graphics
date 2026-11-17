-- Add targeted covering indexes for every FK currently flagged by Supabase.
-- All affected tables were reviewed: current live row counts are zero or one
-- (largest relation below 120 KB). This avoids broad indexing of unrelated tables.
DO $$
DECLARE
  fk record;
  idx_name text;
BEGIN
  FOR fk IN
    SELECT c.oid,
           c.conname,
           n.nspname AS schema_name,
           t.relname AS table_name,
           c.conkey,
           string_agg(format('%I', a.attname), ', ' ORDER BY u.ord) AS column_sql
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN unnest(c.conkey) WITH ORDINALITY u(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = u.attnum
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND c.conname = ANY (ARRAY[
    'growth_attribution_events_lead_id_fkey',
    'growth_autonomous_schedules_created_by_fkey',
    'growth_campaign_optimization_actions_approved_by_fkey',
    'growth_campaign_optimization_actions_created_by_fkey',
    'growth_command_action_feedback_action_id_fkey',
    'growth_command_action_feedback_task_id_fkey',
    'growth_content_publication_events_job_id_fkey',
    'growth_content_publication_events_social_account_id_fkey',
    'growth_email_templates_created_by_fkey',
    'growth_email_templates_updated_by_fkey',
    'growth_external_effect_reconciliations_actor_id_fkey',
    'growth_integrations_updated_by_fkey',
    'growth_invoices_subscription_id_fkey',
    'growth_knowledge_retrieval_evaluations_created_by_fkey',
    'growth_leads_source_prospect_id_fkey',
    'growth_manual_payments_subscription_id_fkey',
    'growth_marketing_financial_entries_created_by_fkey',
    'growth_marketing_financial_entries_lead_id_fkey',
    'growth_meetings_assigned_to_fkey',
    'growth_meetings_created_by_fkey',
    'growth_meetings_lead_id_fkey',
    'growth_platform_integration_events_actor_id_fkey',
    'growth_platform_integrations_updated_by_fkey',
    'growth_platform_usage_plan_limits_updated_by_fkey',
    'growth_promotion_clicks_promotion_link_id_fkey',
    'growth_promotion_links_created_by_fkey',
    'growth_proposals_approved_by_fkey',
    'growth_proposals_created_by_fkey',
    'growth_proposals_delivery_job_id_fkey',
    'growth_proposals_lead_id_fkey',
    'growth_prospect_discovery_runs_created_by_fkey',
    'growth_prospects_created_by_fkey',
    'growth_retention_touchpoints_approved_by_fkey',
    'growth_retention_touchpoints_created_by_fkey',
    'growth_retention_touchpoints_lead_id_fkey',
    'growth_review_events_request_id_fkey',
    'growth_review_events_review_id_fkey',
    'growth_review_requests_job_id_fkey',
    'growth_review_requests_lead_id_fkey',
    'growth_seo_analytics_metrics_website_id_fkey',
    'growth_seo_keywords_created_by_fkey',
    'growth_seo_keywords_website_id_fkey',
    'growth_seo_search_metrics_website_id_fkey',
    'growth_seo_tasks_completed_by_fkey',
    'growth_seo_tasks_created_by_fkey',
    'growth_seo_tasks_website_id_fkey',
    'growth_sms_messages_conversation_id_fkey',
    'growth_sms_messages_initiated_by_fkey',
    'growth_sms_messages_lead_id_fkey',
    'growth_social_comments_reply_claimed_by_fkey',
    'growth_strategy_plans_created_by_fkey',
    'growth_voice_call_attempts_initiated_by_fkey',
    'growth_website_audits_website_id_fkey',
    'growth_website_form_submissions_lead_id_fkey',
    'growth_website_tracking_keys_created_by_fkey',
    'growth_whatsapp_call_sessions_initiated_by_fkey',
    'growth_whatsapp_call_sessions_lead_id_fkey',
    'growth_whatsapp_call_sessions_permission_id_fkey'
      ])
    GROUP BY c.oid, c.conname, n.nspname, t.relname, c.conkey
  LOOP
    -- Keep identifiers below PostgreSQL's 63-byte limit and deterministic.
    idx_name := 'fkidx_' || substr(md5(fk.conname), 1, 12) || '_' || left(fk.table_name, 30);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
      idx_name, fk.schema_name, fk.table_name, fk.column_sql
    );
  END LOOP;
END
$$;

-- Remove redundant SELECT overlap while preserving the same effective access.
DROP POLICY IF EXISTS growth_attribution_manager_write ON public.growth_attribution_events;
CREATE POLICY growth_attribution_manager_insert
  ON public.growth_attribution_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.growth_members m
    WHERE m.organization_id = growth_attribution_events.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role = ANY (ARRAY['owner'::text, 'manager'::text])
  ));
CREATE POLICY growth_attribution_manager_update
  ON public.growth_attribution_events FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.growth_members m
    WHERE m.organization_id = growth_attribution_events.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role = ANY (ARRAY['owner'::text, 'manager'::text])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.growth_members m
    WHERE m.organization_id = growth_attribution_events.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role = ANY (ARRAY['owner'::text, 'manager'::text])
  ));
CREATE POLICY growth_attribution_manager_delete
  ON public.growth_attribution_events FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.growth_members m
    WHERE m.organization_id = growth_attribution_events.organization_id
      AND m.user_id = (SELECT auth.uid())
      AND m.role = ANY (ARRAY['owner'::text, 'manager'::text])
  ));

DROP POLICY IF EXISTS growth_autonomous_schedules_manager_write ON public.growth_autonomous_schedules;
CREATE POLICY growth_autonomous_schedules_manager_insert
  ON public.growth_autonomous_schedules FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.growth_members m
      WHERE m.organization_id = growth_autonomous_schedules.organization_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role = ANY (ARRAY['owner'::text, 'manager'::text])
    ) OR (SELECT public.is_anaira_admin())
  );
CREATE POLICY growth_autonomous_schedules_manager_update
  ON public.growth_autonomous_schedules FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.growth_members m
      WHERE m.organization_id = growth_autonomous_schedules.organization_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role = ANY (ARRAY['owner'::text, 'manager'::text])
    ) OR (SELECT public.is_anaira_admin())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.growth_members m
      WHERE m.organization_id = growth_autonomous_schedules.organization_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role = ANY (ARRAY['owner'::text, 'manager'::text])
    ) OR (SELECT public.is_anaira_admin())
  );
CREATE POLICY growth_autonomous_schedules_manager_delete
  ON public.growth_autonomous_schedules FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.growth_members m
      WHERE m.organization_id = growth_autonomous_schedules.organization_id
        AND m.user_id = (SELECT auth.uid())
        AND m.role = ANY (ARRAY['owner'::text, 'manager'::text])
    ) OR (SELECT public.is_anaira_admin())
  );

DROP POLICY IF EXISTS "Admins manage projects" ON public.projects;
CREATE POLICY "Admins insert projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_anaira_admin()));
CREATE POLICY "Admins update projects"
  ON public.projects FOR UPDATE TO authenticated
  USING ((SELECT public.is_anaira_admin()))
  WITH CHECK ((SELECT public.is_anaira_admin()));
CREATE POLICY "Admins delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING ((SELECT public.is_anaira_admin()));

DROP POLICY IF EXISTS "Admins manage settings" ON public.site_settings;
CREATE POLICY "Admins insert settings"
  ON public.site_settings FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_anaira_admin()));
CREATE POLICY "Admins update settings"
  ON public.site_settings FOR UPDATE TO authenticated
  USING ((SELECT public.is_anaira_admin()))
  WITH CHECK ((SELECT public.is_anaira_admin()));
CREATE POLICY "Admins delete settings"
  ON public.site_settings FOR DELETE TO authenticated
  USING ((SELECT public.is_anaira_admin()));
