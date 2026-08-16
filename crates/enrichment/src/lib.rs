use database::Database;
use domain::Business;
use opportunities::OpportunityEngine;
use uuid::Uuid;

pub struct EnrichmentPipeline;

impl EnrichmentPipeline {
    /// Executes progressive enrichment & opportunity detection for a master business
    pub async fn process_business(
        db: &Database,
        business: &mut Business,
    ) -> Result<(), sqlx::Error> {
        // 1. Evaluate Opportunities & Priority
        let (opps, priority, score) = OpportunityEngine::evaluate_business(business);
        business.priority = priority;
        business.priority_score = score;
        business.status = domain::BusinessStatus::OpportunityFound;

        // Persist updated business
        db.save_business(business).await?;

        // Save generated opportunities
        for opp in opps {
            db.save_opportunity(&opp).await?;
        }

        // Add activity record
        db.add_activity(
            Some(business.id),
            None,
            "opportunity.identified",
            "Client Intelligence Analysis Completed",
            Some(&format!(
                "Identified high-impact opportunities with {} priority.",
                business.priority
            )),
            &serde_json::json!({
                "priority": format!("{}", business.priority),
                "score": business.priority_score,
            }),
        )
        .await?;

        Ok(())
    }
}
