/* Textile AI Audit — measurement layer (no DOM, no AI).
 * 1. FORMS: the records department staff fill in (shift, day, lot, week, month).
 * 2. KPIS: how every dashboard KPI is calculated from APPROVED records only.
 * 3. Coverage: how much of the dashboard is measured vs "Not measured".
 * 4. Evidence: control charts, trend, stratification (Welch t-test) and Pareto.
 * Deterministic and shared by the browser (window.TM) and the server (CommonJS). */
(function (root) {
  'use strict';
  const D = typeof module !== 'undefined' && module.exports ? require('./data.js') : root.TD;
  const TA = typeof module !== 'undefined' && module.exports ? require('./engine.js') : root.TA;

  const PLANT_IDS = ['FSD', 'KHI', 'LHR', 'GRP'];
  const DEPARTMENTS = Object.keys(D.SECTIONS); // a department is a dashboard section
  const TEXT_RE = /^[\p{L}\p{N} ._\-/#()&+]{1,40}$/u;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const PERIODS = { m: 30, q: 91, y: 365 };

  // ---------- field builders ----------
  const num = (k, label, unit, min, max, o = {}) => ({ k, label, unit, kind: 'num', min, max, req: !!o.req, help: o.help || '' });
  const int = (k, label, min, max, o = {}) => ({ k, label, unit: o.unit || 'count', kind: 'int', min, max, req: !!o.req, help: o.help || '' });
  const yn = (k, label, o = {}) => ({ k, label, unit: '', kind: 'yesno', min: 0, max: 1, req: !!o.req, help: o.help || '' });
  const txt = (k, label, o = {}) => ({ k, label, unit: '', kind: 'text', req: !!o.req, help: o.help || '', dim: true });
  const pick = (k, label, options, o = {}) => ({ k, label, unit: '', kind: 'choice', options, req: o.req !== false, help: o.help || '', dim: true });
  const SHIFT = pick('shift', 'Shift', ['A', 'B', 'C']);
  const AREAS = ['spinning', 'weaving', 'dyeing', 'cutting', 'sewing', 'quality'];
  const isNum = v => typeof v === 'number' && Number.isFinite(v);
  const has = (...v) => v.every(isNum);

  // ---------- 1. record forms ----------
  // period: how much time one record covers. key: fields that, with plant + date, identify a duplicate.
  const FORMS = {
    spin_shift: {
      label: 'Spinning shift report', depts: ['spinning'], period: 'shift', key: ['shift', 'machine'],
      fields: [SHIFT, txt('machine', 'Ring frame / line', { req: true }), txt('supplier_lot', 'Cotton supplier lot'),
        num('cotton_kg', 'Cotton fed', 'kg', 1, 1e6, { req: true }), num('yarn_kg', 'Good yarn produced', 'kg', 0, 1e6, { req: true }),
        num('waste_total_kg', 'Total waste', 'kg', 0, 1e6, { req: true }), num('waste_blowroom_kg', 'Blow-room waste', 'kg', 0, 1e6),
        num('waste_card_kg', 'Card waste', 'kg', 0, 1e6), num('comber_feed_kg', 'Comber feed', 'kg', 0, 1e6), num('comber_noil_kg', 'Comber noil', 'kg', 0, 1e6),
        num('cv_pct', 'Yarn evenness (Uster CV%)', '%', 3, 40), num('hairiness', 'Hairiness index', '', 1, 20), num('csp', 'CSP', '', 500, 5000),
        int('bales_checked', 'Bales checked for contamination', 0, 10000), num('contamination_g', 'Contamination found', 'g', 0, 1e5),
        int('spindles_flagged', 'Spindles flagged by monitoring (now)', 0, 100000)],
      rules: [
        { msg: 'Yarn plus waste cannot be more than the cotton fed (+2% moisture).', bad: d => d.yarn_kg + d.waste_total_kg > d.cotton_kg * 1.02 },
        { msg: 'Blow-room plus card waste cannot be more than total waste.', bad: d => (d.waste_blowroom_kg || 0) + (d.waste_card_kg || 0) > d.waste_total_kg * 1.02 },
        { msg: 'Comber noil cannot be more than comber feed.', bad: d => has(d.comber_noil_kg) && !(has(d.comber_feed_kg) && d.comber_noil_kg <= d.comber_feed_kg) },
        { msg: 'Enter how many bales were checked for the contamination you found.', bad: d => has(d.contamination_g) && !(d.bales_checked > 0) },
      ],
    },
    weave_shift: {
      label: 'Weaving / knitting shift report', depts: ['weaving'], period: 'shift', key: ['shift', 'machine'],
      fields: [SHIFT, txt('machine', 'Shed / loom group', { req: true }),
        num('loom_hours_avail', 'Loom hours available', 'h', 0, 1e5), num('loom_hours_run', 'Loom hours running', 'h', 0, 1e5),
        num('picks', 'Picks inserted', 'picks', 0, 1e11), int('warp_breaks', 'Warp breaks', 0, 1e6), int('stops', 'Loom stops', 0, 1e6),
        num('mend_min', 'Minutes spent mending stops', 'min', 0, 1e6),
        num('knit_hours_avail', 'Knitting machine hours available', 'h', 0, 1e5), num('knit_hours_run', 'Knitting machine hours running', 'h', 0, 1e5)],
      rules: [
        { msg: 'Enter loom hours or knitting hours.', bad: d => !has(d.loom_hours_avail) && !has(d.knit_hours_avail) },
        { msg: 'Running hours cannot be more than available hours.', bad: d => (has(d.loom_hours_run) && !(d.loom_hours_run <= (d.loom_hours_avail ?? -1))) || (has(d.knit_hours_run) && !(d.knit_hours_run <= (d.knit_hours_avail ?? -1))) },
        { msg: 'Enter the picks inserted for the warp breaks you counted.', bad: d => has(d.warp_breaks) && !(d.picks > 0) },
      ],
    },
    fabric_inspection: {
      label: 'Greige / knitted fabric inspection', depts: ['weaving', 'quality'], period: 'day', key: ['article'],
      fields: [txt('article', 'Fabric article / quality', { req: true }),
        int('rolls_inspected', 'Rolls inspected', 1, 1e5, { req: true }), int('rolls_over_limit', 'Rolls over the 4-point limit', 0, 1e5, { req: true }),
        num('meters_inspected', 'Meters inspected', 'm', 1, 1e7, { req: true }), num('meters_defective', 'Meters with defects', 'm', 0, 1e7, { req: true }),
        num('gsm_dev_pct', 'GSM deviation from spec (absolute)', '%', 0, 50), num('usable_width_in', 'Usable width', 'in', 10, 140)],
      rules: [
        { msg: 'Rolls over limit cannot be more than rolls inspected.', bad: d => d.rolls_over_limit > d.rolls_inspected },
        { msg: 'Defective meters cannot be more than meters inspected.', bad: d => d.meters_defective > d.meters_inspected },
      ],
    },
    dye_lot: {
      label: 'Dye lot result', depts: ['dyeing'], period: 'event', key: ['lot_no'],
      fields: [txt('lot_no', 'Lot number', { req: true }), txt('machine', 'Dye machine / jet', { req: true }), txt('shade', 'Shade / colour'),
        num('lot_kg', 'Lot weight', 'kg', 1, 1e5, { req: true }), yn('rft', 'Right first time (approved without correction)?', { req: true }),
        yn('redyed', 'Had to be re-dyed or stripped?', { req: true }), yn('lab_bulk_pass', 'Lab-to-bulk ΔE passed?'),
        num('chem_recipe_kg', 'Chemicals & dyes in recipe', 'kg', 0, 1e5), num('chem_actual_kg', 'Chemicals & dyes actually used', 'kg', 0, 1e5),
        num('water_l', 'Water used', 'L', 0, 1e8), num('shrinkage_pct', 'Shrinkage after compacting', '%', 0, 30),
        yn('colorfast_fail', 'Failed a colourfastness test?'), num('lab_dip_days', 'Days from lab-dip submit to buyer approval', 'days', 0, 180)],
      rules: [
        { msg: 'A lot cannot be right-first-time and also re-dyed.', bad: d => d.rft === 1 && d.redyed === 1 },
        { msg: 'Enter both recipe and actual chemicals, or neither.', bad: d => has(d.chem_recipe_kg) !== has(d.chem_actual_kg) },
      ],
      derive: { chem_dev_kg: d => (has(d.chem_actual_kg, d.chem_recipe_kg) ? Math.abs(d.chem_actual_kg - d.chem_recipe_kg) : null) },
    },
    dyehouse_day: {
      label: 'Dye-house capacity (daily)', depts: ['dyeing', 'planning'], period: 'day', key: [],
      fields: [num('hours_loaded', 'Machine hours of work loaded', 'h', 0, 1e5, { req: true }), num('hours_available', 'Machine hours available', 'h', 1, 1e5, { req: true })],
      rules: [{ msg: 'Loaded hours above 200% of available looks like a typing error.', bad: d => d.hours_loaded > d.hours_available * 2 }],
    },
    cutting_lay: {
      label: 'Cutting lay', depts: ['cutting'], period: 'event', key: ['lay_no'],
      fields: [txt('lay_no', 'Lay / cut number', { req: true }), txt('style', 'Style'),
        num('marker_eff_pct', 'Marker efficiency (CAD)', '%', 30, 100, { req: true }),
        num('fabric_issued_m', 'Fabric issued to the lay', 'm', 1, 1e6, { req: true }), num('fabric_used_m', 'Fabric in good cut panels', 'm', 0, 1e6, { req: true }),
        num('end_loss_m', 'End loss', 'm', 0, 1e5), int('plies', 'Plies in the lay', 1, 500, { req: true }), int('garments', 'Garments cut', 1, 1e6, { req: true }),
        num('remnant_m', 'Remnants left', 'm', 0, 1e5), num('remnant_written_off_m', 'Remnants written off', 'm', 0, 1e5)],
      rules: [
        { msg: 'Fabric in cut panels cannot be more than fabric issued.', bad: d => d.fabric_used_m > d.fabric_issued_m },
        { msg: 'End loss cannot be more than fabric issued.', bad: d => has(d.end_loss_m) && d.end_loss_m > d.fabric_issued_m },
        { msg: 'Remnants written off cannot be more than remnants left.', bad: d => has(d.remnant_written_off_m) && !(has(d.remnant_m) && d.remnant_written_off_m <= d.remnant_m) },
      ],
    },
    sewing_line_day: {
      label: 'Sewing line day', depts: ['sewing'], period: 'day', key: ['line'],
      fields: [txt('line', 'Line', { req: true }), txt('style', 'Style'),
        int('output_pcs', 'Good pieces out', 0, 1e6, { req: true }), num('sam_min', 'SAM of the style', 'min', 0.5, 300, { req: true }),
        int('operators', 'Operators on the line', 1, 1000, { req: true }), num('hours', 'Hours worked', 'h', 0.5, 24, { req: true }),
        int('pcs_checked', 'Pieces checked inline', 0, 1e6), int('defects', 'Defects found inline', 0, 1e7), int('first_pass_pcs', 'Pieces passed first time', 0, 1e6),
        int('reworked_pcs', 'Pieces reworked', 0, 1e6), int('rostered', 'Operators rostered', 0, 1000), int('absent', 'Operators absent', 0, 1000),
        int('wip_pcs', 'Cut pieces waiting at the line (WIP)', 0, 1e7), yn('sam_verified', 'SAM verified by work-study?')],
      rules: [
        { msg: 'First-pass pieces cannot be more than pieces checked.', bad: d => has(d.first_pass_pcs) && !(has(d.pcs_checked) && d.first_pass_pcs <= d.pcs_checked) },
        { msg: 'Enter pieces checked for the defects you found.', bad: d => has(d.defects) && !(d.pcs_checked > 0) },
        { msg: 'Reworked pieces cannot be more than pieces out.', bad: d => has(d.reworked_pcs) && d.reworked_pcs > d.output_pcs },
        { msg: 'Absent operators cannot be more than rostered.', bad: d => has(d.absent) && !(has(d.rostered) && d.absent <= d.rostered) },
        { msg: 'Line efficiency above 150% looks like a typing error (check SAM, operators and hours).', bad: d => d.output_pcs * d.sam_min > d.operators * d.hours * 60 * 1.5 },
      ],
      derive: { earned_min: d => d.output_pcs * d.sam_min, avail_min: d => d.operators * d.hours * 60, worker_h: d => d.operators * d.hours },
    },
    quality_day: {
      label: 'Quality daily summary', depts: ['quality'], period: 'day', key: [],
      fields: [int('pcs_produced', 'Pieces produced', 0, 1e7), int('seconds_pcs', 'Seconds / downgraded', 0, 1e7), int('rejected_pcs', 'Rejected', 0, 1e7),
        int('scrap_pcs', 'Scrapped', 0, 1e7), int('final_inspections', 'Final AQL inspections', 0, 1e5), int('final_failed', 'Final AQL inspections failed', 0, 1e5),
        int('rolls_received', 'Fabric rolls received', 0, 1e6), int('rolls_inspected', 'Fabric rolls inspected before cutting', 0, 1e6)],
      rules: [
        { msg: 'Seconds, rejects and scrap together cannot be more than pieces produced.', bad: d => ((d.seconds_pcs || 0) + (d.rejected_pcs || 0) + (d.scrap_pcs || 0)) > 0 && !(has(d.pcs_produced) && (d.seconds_pcs || 0) + (d.rejected_pcs || 0) + (d.scrap_pcs || 0) <= d.pcs_produced) },
        { msg: 'Failed inspections cannot be more than inspections.', bad: d => has(d.final_failed) && !(has(d.final_inspections) && d.final_failed <= d.final_inspections) },
        { msg: 'Rolls inspected cannot be more than rolls received.', bad: d => has(d.rolls_inspected) && !(has(d.rolls_received) && d.rolls_inspected <= d.rolls_received) },
      ],
    },
    defect_log: {
      label: 'Defect tally', depts: ['quality', 'sewing', 'weaving', 'dyeing', 'cutting'], period: 'event', key: null,
      fields: [pick('area', 'Area', AREAS), txt('line', 'Line / machine'),
        pick('defect_type', 'Defect type', ['Broken stitch', 'Skip stitch', 'Open seam', 'Uneven hem', 'Shade variation', 'Stain / oil spot', 'Hole', 'Measurement out of tolerance', 'Wrong label', 'Fabric fault', 'Other']),
        int('pcs', 'Pieces with this defect', 1, 1e6, { req: true })],
    },
    maintenance_day: {
      label: 'Maintenance daily summary', depts: ['maintenance'], period: 'day', key: [],
      fields: [int('pm_planned', 'PM jobs planned', 0, 1e5), int('pm_done', 'PM jobs done', 0, 1e5), int('breakdowns', 'Breakdowns', 0, 1e5),
        num('repair_h', 'Hours spent repairing breakdowns', 'h', 0, 1e5), int('wo_total', 'Work orders closed', 0, 1e5), int('wo_breakdown', 'of which breakdown work orders', 0, 1e5),
        int('spares_requested', 'Critical spares requested', 0, 1e5), int('spares_available', 'Critical spares available from stock', 0, 1e5),
        num('unplanned_downtime_h', 'Unplanned downtime (all machines)', 'h', 0, 1e5), int('open_wo', 'Open work orders (now)', 0, 1e5),
        num('jet_run_h', 'Dye-jet running hours', 'h', 0, 1e5), int('jet_failures', 'Dye-jet failures', 0, 1e4)],
      rules: [
        { msg: 'Breakdown work orders cannot be more than work orders closed.', bad: d => has(d.wo_breakdown) && !(has(d.wo_total) && d.wo_breakdown <= d.wo_total) },
        { msg: 'Spares available cannot be more than spares requested.', bad: d => has(d.spares_available) && !(has(d.spares_requested) && d.spares_available <= d.spares_requested) },
        { msg: 'Repair hours need at least one breakdown.', bad: d => d.repair_h > 0 && !(d.breakdowns > 0) },
      ],
    },
    downtime_event: {
      label: 'Downtime event', depts: ['maintenance', 'spinning', 'weaving', 'dyeing', 'cutting', 'sewing', 'planning'], period: 'event', key: null,
      fields: [pick('area', 'Area', AREAS), txt('machine', 'Machine', { req: true }),
        pick('reason', 'Reason', ['Mechanical breakdown', 'Electrical breakdown', 'Power / gas outage', 'Changeover', 'Waiting for material', 'Waiting for operator', 'Quality hold', 'Planned maintenance', 'Other']),
        num('minutes', 'Minutes stopped', 'min', 1, 10080, { req: true })],
    },
    planning_week: {
      label: 'Planning weekly review', depts: ['planning'], period: 'week', key: [],
      fields: [int('orders_shipped', 'Orders shipped', 0, 1e5), int('orders_otif', 'of which on time and in full', 0, 1e5),
        int('plan_items', 'Schedule items planned', 0, 1e5), int('plan_on_time', 'Schedule items done on time', 0, 1e5),
        num('planned_min', 'Planned production time', 'min', 0, 1e8), int('good_units', 'Good units produced', 0, 1e8), num('ideal_cycle_min', 'Ideal cycle time per unit', 'min', 0.001, 1e4),
        num('bottleneck_load_h', 'Hours of work loaded on the bottleneck', 'h', 0, 1e5), num('bottleneck_capacity_h', 'Bottleneck hours available', 'h', 0, 1e5),
        int('changeovers', 'Changeovers', 0, 1e5), num('changeover_min', 'Total changeover time', 'min', 0, 1e7),
        num('lead_days', 'Average order lead time (confirmation to shipment)', 'days', 0, 400), num('backlog_weeks', 'Order backlog (now)', 'weeks', 0, 104),
        num('expedite_pkr_m', 'Expedite cost (air freight, overtime)', 'PKR M', 0, 1e4)],
      rules: [
        { msg: 'OTIF orders cannot be more than orders shipped.', bad: d => has(d.orders_otif) && !(has(d.orders_shipped) && d.orders_otif <= d.orders_shipped) },
        { msg: 'Items on time cannot be more than items planned.', bad: d => has(d.plan_on_time) && !(has(d.plan_items) && d.plan_on_time <= d.plan_items) },
        { msg: 'OEE above 105% looks like a typing error (check good units, ideal cycle and planned time).', bad: d => has(d.good_units, d.ideal_cycle_min, d.planned_min) && d.good_units * d.ideal_cycle_min > d.planned_min * 1.05 },
      ],
      derive: { oee_num_min: d => (has(d.good_units, d.ideal_cycle_min) ? d.good_units * d.ideal_cycle_min : null) },
    },
    inventory_month: {
      label: 'Inventory month-end', depts: ['inventory'], period: 'month', key: [],
      fields: [num('inventory_value_m', 'Inventory value', 'PKR M', 0, 1e6), num('cogs_month_m', 'Cost of goods sold this month', 'PKR M', 0, 1e6),
        num('slow_moving_m', 'Slow-moving stock (> 90 days)', 'PKR M', 0, 1e6), num('obsolete_writeoff_m', 'Obsolete stock written off', 'PKR M', 0, 1e6),
        int('items_counted', 'Items cycle-counted', 0, 1e6), int('items_accurate', 'Items matching the system', 0, 1e6),
        num('yarn_stock_kg', 'Yarn in stock', 'kg', 0, 1e8), num('yarn_daily_use_kg', 'Yarn used per day', 'kg', 0, 1e7),
        num('fg_cancelled_m', 'Finished goods for cancelled orders', 'PKR M', 0, 1e6)],
      rules: [
        { msg: 'Accurate items cannot be more than items counted.', bad: d => has(d.items_accurate) && !(has(d.items_counted) && d.items_accurate <= d.items_counted) },
        { msg: 'Slow-moving stock cannot be more than total inventory.', bad: d => has(d.slow_moving_m, d.inventory_value_m) && d.slow_moving_m > d.inventory_value_m },
      ],
    },
    procurement_po: {
      label: 'Purchase order received', depts: ['procurement'], period: 'event', key: ['po_no'],
      fields: [txt('po_no', 'PO number', { req: true }), txt('supplier', 'Supplier', { req: true }),
        yn('otif', 'Delivered on time and in full?', { req: true }), num('qty_received', 'Quantity received', 'units', 0.001, 1e9, { req: true }),
        num('qty_rejected', 'Quantity rejected at incoming inspection', 'units', 0, 1e9, { req: true }),
        num('value_pkr_m', 'PO value', 'PKR M', 0, 1e5, { req: true }), num('ppv_pkr_m', 'Price variance vs standard (+ = paid more)', 'PKR M', -1e4, 1e4),
        yn('spot_buy', 'Spot buy (not on contract)?', { req: true })],
      rules: [{ msg: 'Rejected quantity cannot be more than quantity received.', bad: d => d.qty_rejected > d.qty_received }],
      derive: { spot_value_m: d => (has(d.value_pkr_m) ? d.value_pkr_m * (d.spot_buy === 1 ? 1 : 0) : null) },
    },
    finance_month: {
      label: 'Finance month-end', depts: ['finance'], period: 'month', key: [],
      fields: [num('sales_m', 'Net sales', 'PKR M', 0.001, 1e6, { req: true }), num('cogs_m', 'Cost of goods sold', 'PKR M', 0, 1e6, { req: true }),
        num('std_cost_m', 'Standard cost of output', 'PKR M', 0, 1e6), num('actual_cost_m', 'Actual cost of output', 'PKR M', 0, 1e6),
        num('receivables_m', 'Trade receivables (month-end)', 'PKR M', 0, 1e6), num('payables_m', 'Trade payables (month-end)', 'PKR M', 0, 1e6),
        num('purchases_m', 'Purchases this month', 'PKR M', 0, 1e6), num('refunds_held_m', 'Sales-tax refunds held (now)', 'PKR M', 0, 1e6),
        int('lc_presented', 'LC document sets presented', 0, 1e5), int('lc_discrepant', 'of which discrepant', 0, 1e5),
        num('gross_invoiced_m', 'Gross invoiced', 'PKR M', 0, 1e6), num('discounts_m', 'Unplanned discounts & credit notes', 'PKR M', 0, 1e6),
        num('chargebacks_m', 'Customer chargebacks', 'PKR M', 0, 1e6), num('claims_m', 'Customer claims', 'PKR M', 0, 1e6),
        num('copq_m', 'Cost of poor quality (rework, scrap, claims, re-dye)', 'PKR M', 0, 1e6),
        num('fx_receivable_m', 'Foreign-currency receivables', 'PKR M', 0, 1e6), num('fx_unhedged_m', 'of which unhedged', 'PKR M', 0, 1e6),
        num('overhead_m', 'Factory overhead', 'PKR M', 0, 1e6), int('shirts_shipped', 'Garments shipped', 0, 1e8), num('freight_m', 'Outbound freight', 'PKR M', 0, 1e5)],
      rules: [
        { msg: 'Discrepant LC sets cannot be more than sets presented.', bad: d => has(d.lc_discrepant) && !(has(d.lc_presented) && d.lc_discrepant <= d.lc_presented) },
        { msg: 'Unhedged exposure cannot be more than foreign-currency receivables.', bad: d => has(d.fx_unhedged_m) && !(has(d.fx_receivable_m) && d.fx_unhedged_m <= d.fx_receivable_m) },
        { msg: 'Enter both standard and actual cost, or neither.', bad: d => has(d.std_cost_m) !== has(d.actual_cost_m) },
      ],
      derive: { gm_m: d => d.sales_m - d.cogs_m, cost_var_m: d => (has(d.actual_cost_m, d.std_cost_m) ? d.actual_cost_m - d.std_cost_m : null) },
    },
    cost_rates: {
      label: 'Cost rates (for PKR impact)', depts: ['finance'], period: 'month', key: [],
      fields: [num('cotton_pkr_kg', 'Cotton cost', 'PKR/kg', 1, 1e5), num('fabric_pkr_m', 'Fabric cost', 'PKR/m', 1, 1e5),
        num('redye_pkr_lot', 'Cost of one re-dye', 'PKR/lot', 1, 1e8), num('labour_pkr_min', 'Sewing labour cost', 'PKR/min', 0.01, 1e4),
        num('rework_pkr_pc', 'Cost to rework one piece', 'PKR/pc', 0.01, 1e5), num('garment_pkr_pc', 'Cost of one rejected garment', 'PKR/pc', 0.01, 1e5),
        num('constraint_pkr_h', 'Lost margin per bottleneck hour', 'PKR/h', 1, 1e8)],
    },
  };
  Object.entries(FORMS).forEach(([id, f]) => { f.id = id; f.rules = f.rules || []; f.derive = f.derive || {}; });

  // ---------- 2. KPI definitions ----------
  // t: ratio (Σnum ÷ Σden × scale; den '#' = number of records) · avg (optionally weighted) ·
  //    sum (normalised to perDays) · latest (snapshot per plant/dimension) · share (latest yes/no per dimension) · combo (± other KPIs)
  const KPIS = {};
  const def = (sec, name, d) => { KPIS[`${sec}|${name}`] = { key: `${sec}|${name}`, sec, name, scale: 1, ...d }; };
  const pct = 100;
  def('spinning', 'Yarn yield', { form: 'spin_shift', t: 'ratio', num: 'yarn_kg', den: 'cotton_kg', scale: pct, impact: { rate: 'cotton_pkr_kg', base: 'cotton_kg' } });
  def('spinning', 'Spinning waste', { form: 'spin_shift', t: 'ratio', num: 'waste_total_kg', den: 'cotton_kg', scale: pct });
  def('spinning', 'Blow room loss', { form: 'spin_shift', t: 'ratio', num: 'waste_blowroom_kg', den: 'cotton_kg', scale: pct });
  def('spinning', 'Card waste', { form: 'spin_shift', t: 'ratio', num: 'waste_card_kg', den: 'cotton_kg', scale: pct });
  def('spinning', 'Comber noil', { form: 'spin_shift', t: 'ratio', num: 'comber_noil_kg', den: 'comber_feed_kg', scale: pct });
  def('spinning', 'Yarn evenness CV%', { form: 'spin_shift', t: 'avg', v: 'cv_pct', w: 'yarn_kg' });
  def('spinning', 'Hairiness index', { form: 'spin_shift', t: 'avg', v: 'hairiness', w: 'yarn_kg' });
  def('spinning', 'CSP (30s combed)', { form: 'spin_shift', t: 'avg', v: 'csp' });
  def('spinning', 'Contamination', { form: 'spin_shift', t: 'ratio', num: 'contamination_g', den: 'bales_checked' });
  def('spinning', 'Flagged spindles', { form: 'spin_shift', t: 'latest', v: 'spindles_flagged', by: ['machine'], agg: 'sum' });

  def('weaving', 'Loom efficiency', { form: 'weave_shift', t: 'ratio', num: 'loom_hours_run', den: 'loom_hours_avail', scale: pct });
  def('weaving', 'Warp breaks', { form: 'weave_shift', t: 'ratio', num: 'warp_breaks', den: 'picks', scale: 1e5 });
  def('weaving', 'Fabric defect rate', { form: 'fabric_inspection', t: 'ratio', num: 'meters_defective', den: 'meters_inspected', scale: pct, impact: { rate: 'fabric_pkr_m', base: 'meters_inspected' } });
  def('weaving', 'Rolls over 4-point limit', { form: 'fabric_inspection', t: 'ratio', num: 'rolls_over_limit', den: 'rolls_inspected', scale: pct });
  def('weaving', 'Mend time per stop', { form: 'weave_shift', t: 'ratio', num: 'mend_min', den: 'stops' });
  def('weaving', 'Knitting machine efficiency', { form: 'weave_shift', t: 'ratio', num: 'knit_hours_run', den: 'knit_hours_avail', scale: pct });
  def('weaving', 'GSM deviation', { form: 'fabric_inspection', t: 'avg', v: 'gsm_dev_pct', w: 'meters_inspected' });
  def('weaving', 'Usable width', { form: 'fabric_inspection', t: 'avg', v: 'usable_width_in', w: 'meters_inspected' });

  def('dyeing', 'Right-first-time dyeing', { form: 'dye_lot', t: 'ratio', num: 'rft', den: '#', scale: pct });
  def('dyeing', 'Re-dye / strip', { form: 'dye_lot', t: 'ratio', num: 'redyed', den: '#', scale: pct, impact: { rate: 'redye_pkr_lot', base: '#' } });
  def('dyeing', 'Lab-to-bulk ΔE pass', { form: 'dye_lot', t: 'ratio', num: 'lab_bulk_pass', den: '#', scale: pct });
  def('dyeing', 'Lab-dip approval cycle', { form: 'dye_lot', t: 'avg', v: 'lab_dip_days' });
  def('dyeing', 'Chemical vs recipe', { form: 'dye_lot', t: 'ratio', num: 'chem_dev_kg', den: 'chem_recipe_kg', scale: pct });
  def('dyeing', 'Dye-house load', { form: 'dyehouse_day', t: 'ratio', num: 'hours_loaded', den: 'hours_available', scale: pct });
  def('dyeing', 'Water use', { form: 'dye_lot', t: 'ratio', num: 'water_l', den: 'lot_kg' });
  def('dyeing', 'Shrinkage after compacting', { form: 'dye_lot', t: 'avg', v: 'shrinkage_pct', w: 'lot_kg' });
  def('dyeing', 'Colorfastness failures', { form: 'dye_lot', t: 'ratio', num: 'colorfast_fail', den: '#', scale: pct });

  def('cutting', 'Marker efficiency', { form: 'cutting_lay', t: 'avg', v: 'marker_eff_pct', w: 'fabric_issued_m' });
  def('cutting', 'Fabric utilization', { form: 'cutting_lay', t: 'ratio', num: 'fabric_used_m', den: 'fabric_issued_m', scale: pct, impact: { rate: 'fabric_pkr_m', base: 'fabric_issued_m' } });
  def('cutting', 'End loss', { form: 'cutting_lay', t: 'ratio', num: 'end_loss_m', den: 'fabric_issued_m', scale: pct });
  def('cutting', 'Fabric per shirt', { form: 'cutting_lay', t: 'ratio', num: 'fabric_issued_m', den: 'garments' });
  def('cutting', 'Average lay height', { form: 'cutting_lay', t: 'avg', v: 'plies' });
  def('cutting', 'Remnants written off', { form: 'cutting_lay', t: 'ratio', num: 'remnant_written_off_m', den: 'remnant_m', scale: pct });

  def('sewing', 'Line efficiency', { form: 'sewing_line_day', t: 'ratio', num: 'earned_min', den: 'avail_min', scale: pct, impact: { rate: 'labour_pkr_min', base: 'avail_min' } });
  def('sewing', 'Inline DHU', { form: 'sewing_line_day', t: 'ratio', num: 'defects', den: 'pcs_checked', scale: pct });
  def('sewing', 'First-pass yield', { form: 'sewing_line_day', t: 'ratio', num: 'first_pass_pcs', den: 'pcs_checked', scale: pct });
  def('sewing', 'Rework rate', { form: 'sewing_line_day', t: 'ratio', num: 'reworked_pcs', den: 'output_pcs', scale: pct, impact: { rate: 'rework_pkr_pc', base: 'output_pcs' } });
  def('sewing', 'Absenteeism', { form: 'sewing_line_day', t: 'ratio', num: 'absent', den: 'rostered', scale: pct });
  def('sewing', 'Styles with verified SAM', { form: 'sewing_line_day', t: 'share', v: 'sam_verified', by: 'style' });
  def('sewing', 'Cut-to-sew WIP', { form: 'sewing_line_day', t: 'ratio', num: 'wip_pcs', den: 'output_pcs' });
  def('sewing', 'Output per worker-hour', { form: 'sewing_line_day', t: 'ratio', num: 'output_pcs', den: 'worker_h' });

  def('quality', 'Cost of poor quality', { form: 'finance_month', t: 'ratio', num: 'copq_m', den: 'sales_m', scale: pct });
  def('quality', 'Final AQL failure', { form: 'quality_day', t: 'ratio', num: 'final_failed', den: 'final_inspections', scale: pct });
  def('quality', 'Seconds & downgrades', { form: 'quality_day', t: 'ratio', num: 'seconds_pcs', den: 'pcs_produced', scale: pct });
  def('quality', 'Reject rate', { form: 'quality_day', t: 'ratio', num: 'rejected_pcs', den: 'pcs_produced', scale: pct, impact: { rate: 'garment_pkr_pc', base: 'pcs_produced' } });
  def('quality', 'Chargebacks', { form: 'finance_month', t: 'ratio', num: 'chargebacks_m', den: 'gross_invoiced_m', scale: pct });
  def('quality', 'Customer claims', { form: 'finance_month', t: 'sum', v: 'claims_m', perDays: 91 });
  def('quality', 'Rolls inspected', { form: 'quality_day', t: 'ratio', num: 'rolls_inspected', den: 'rolls_received', scale: pct });
  def('quality', 'Scrap rate', { form: 'quality_day', t: 'ratio', num: 'scrap_pcs', den: 'pcs_produced', scale: pct, impact: { rate: 'garment_pkr_pc', base: 'pcs_produced' } });

  def('maintenance', 'PM compliance', { form: 'maintenance_day', t: 'ratio', num: 'pm_done', den: 'pm_planned', scale: pct });
  def('maintenance', 'MTBF — dye jets', { form: 'maintenance_day', t: 'ratio', num: 'jet_run_h', den: 'jet_failures' });
  def('maintenance', 'MTTR', { form: 'maintenance_day', t: 'ratio', num: 'repair_h', den: 'breakdowns' });
  def('maintenance', 'Breakdown share of work', { form: 'maintenance_day', t: 'ratio', num: 'wo_breakdown', den: 'wo_total', scale: pct });
  def('maintenance', 'Spares availability', { form: 'maintenance_day', t: 'ratio', num: 'spares_available', den: 'spares_requested', scale: pct });
  def('maintenance', 'Unplanned downtime', { form: 'maintenance_day', t: 'sum', v: 'unplanned_downtime_h', perDays: 30, impact: { rate: 'constraint_pkr_h', direct: true } });
  def('maintenance', 'Open work orders', { form: 'maintenance_day', t: 'latest', v: 'open_wo', agg: 'sum' });

  def('planning', 'OTIF delivery', { form: 'planning_week', t: 'ratio', num: 'orders_otif', den: 'orders_shipped', scale: pct });
  def('planning', 'Schedule adherence', { form: 'planning_week', t: 'ratio', num: 'plan_on_time', den: 'plan_items', scale: pct });
  def('planning', 'OEE (plant)', { form: 'planning_week', t: 'ratio', num: 'oee_num_min', den: 'planned_min', scale: pct });
  def('planning', 'Bottleneck load', { form: 'planning_week', t: 'ratio', num: 'bottleneck_load_h', den: 'bottleneck_capacity_h', scale: pct });
  def('planning', 'Avg changeover', { form: 'planning_week', t: 'ratio', num: 'changeover_min', den: 'changeovers' });
  def('planning', 'Order lead time', { form: 'planning_week', t: 'avg', v: 'lead_days', w: 'orders_shipped' });
  def('planning', 'Order backlog', { form: 'planning_week', t: 'latest', v: 'backlog_weeks', agg: 'avg' });
  def('planning', 'Expedite cost', { form: 'planning_week', t: 'sum', v: 'expedite_pkr_m', perDays: 30 });

  def('inventory', 'Days inventory (DIO)', { form: 'inventory_month', t: 'ratio', num: 'inventory_value_m', den: 'cogs_month_m', scale: 30.44 });
  def('inventory', 'Inventory turnover', { form: 'inventory_month', t: 'ratio', num: 'cogs_month_m', den: 'inventory_value_m', scale: 12 });
  def('inventory', 'Slow-moving stock', { form: 'inventory_month', t: 'latest', v: 'slow_moving_m', agg: 'sum' });
  def('inventory', 'Obsolete write-off', { form: 'inventory_month', t: 'sum', v: 'obsolete_writeoff_m', perDays: 365 });
  def('inventory', 'Stock accuracy', { form: 'inventory_month', t: 'ratio', num: 'items_accurate', den: 'items_counted', scale: pct });
  def('inventory', 'Yarn safety stock', { form: 'inventory_month', t: 'ratio', num: 'yarn_stock_kg', den: 'yarn_daily_use_kg' });
  def('inventory', 'FG for cancelled orders', { form: 'inventory_month', t: 'latest', v: 'fg_cancelled_m', agg: 'sum' });

  def('procurement', 'Supplier OTIF', { form: 'procurement_po', t: 'ratio', num: 'otif', den: '#', scale: pct });
  def('procurement', 'Incoming rejection', { form: 'procurement_po', t: 'ratio', num: 'qty_rejected', den: 'qty_received', scale: pct });
  def('procurement', 'Purchase-price variance', { form: 'procurement_po', t: 'sum', v: 'ppv_pkr_m', perDays: 30 });
  def('procurement', 'Freight per shirt', { form: 'finance_month', t: 'ratio', num: 'freight_m', den: 'shirts_shipped', scale: 1e6 });
  def('procurement', 'Spot buys share', { form: 'procurement_po', t: 'ratio', num: 'spot_value_m', den: 'value_pkr_m', scale: pct });

  def('finance', 'Gross margin', { form: 'finance_month', t: 'ratio', num: 'gm_m', den: 'sales_m', scale: pct });
  def('finance', 'Std vs actual cost variance', { form: 'finance_month', t: 'sum', v: 'cost_var_m', perDays: 30 });
  def('finance', 'DSO', { form: 'finance_month', t: 'ratio', num: 'receivables_m', den: 'sales_m', scale: 30.44 });
  def('finance', 'DPO', { form: 'finance_month', t: 'ratio', num: 'payables_m', den: 'purchases_m', scale: 30.44 });
  def('finance', 'Cash conversion cycle', { t: 'combo', parts: [['inventory|Days inventory (DIO)', 1], ['finance|DSO', 1], ['finance|DPO', -1]] });
  def('finance', 'Sales-tax refunds held', { form: 'finance_month', t: 'latest', v: 'refunds_held_m', agg: 'sum' });
  def('finance', 'LC discrepancy rate', { form: 'finance_month', t: 'ratio', num: 'lc_discrepant', den: 'lc_presented', scale: pct });
  def('finance', 'Discount / credit leakage', { form: 'finance_month', t: 'ratio', num: 'discounts_m', den: 'gross_invoiced_m', scale: pct });
  def('finance', 'Unhedged FX exposure', { form: 'finance_month', t: 'ratio', num: 'fx_unhedged_m', den: 'fx_receivable_m', scale: pct });
  def('finance', 'Overhead per shirt', { form: 'finance_month', t: 'ratio', num: 'overhead_m', den: 'shirts_shipped', scale: 1e6 });

  // Where to look for a Pareto of causes, and which audit-playbook findings are hypotheses for a KPI.
  const DOWNTIME = { form: 'downtime_event', by: 'reason', w: 'minutes', unit: 'min' };
  const DEFECTS = { form: 'defect_log', by: 'defect_type', w: 'pcs', unit: 'pcs' };
  const PARETO = {
    'maintenance|Unplanned downtime': DOWNTIME, 'maintenance|MTBF — dye jets': { ...DOWNTIME, area: 'dyeing' }, 'maintenance|MTTR': DOWNTIME,
    'planning|OEE (plant)': DOWNTIME, 'weaving|Loom efficiency': { ...DOWNTIME, area: 'weaving' }, 'dyeing|Dye-house load': { ...DOWNTIME, area: 'dyeing' },
    'sewing|Line efficiency': { ...DOWNTIME, area: 'sewing' }, 'sewing|Inline DHU': { ...DEFECTS, area: 'sewing' }, 'sewing|First-pass yield': { ...DEFECTS, area: 'sewing' },
    'sewing|Rework rate': { ...DEFECTS, area: 'sewing' }, 'quality|Reject rate': DEFECTS, 'quality|Seconds & downgrades': DEFECTS,
    'quality|Final AQL failure': DEFECTS, 'weaving|Fabric defect rate': { ...DEFECTS, area: 'weaving' },
  };
  const FINDING_KPI = {
    F04: 'weaving|Warp breaks', F05: 'weaving|Warp breaks', F06: 'weaving|Mend time per stop', F07: 'dyeing|Right-first-time dyeing',
    F08: 'dyeing|Lab-dip approval cycle', F09: 'maintenance|MTBF — dye jets', F11: 'dyeing|Right-first-time dyeing', F13: 'cutting|Fabric utilization',
    F14: 'cutting|Remnants written off', F18: 'quality|Customer claims', F21: 'maintenance|Unplanned downtime', F23: 'planning|Expedite cost',
    F24: 'finance|Sales-tax refunds held', F26: 'inventory|FG for cancelled orders', F27: 'finance|Discount / credit leakage',
    F28: 'procurement|Purchase-price variance', F31: 'inventory|Yarn safety stock', F33: 'sewing|Inline DHU',
  };

  // Target, unit and direction come from the section definitions the dashboard already uses.
  const META = {};
  Object.entries(D.SECTIONS).forEach(([sec, s]) => s.kpis.forEach(k => { META[`${sec}|${k[0]}`] = { sec, name: k[0], unit: k[2], target: k[3], dir: k[4], plants: s.plants }; }));

  // ---------- dates ----------
  const dayMs = 864e5;
  const toMs = d => Date.parse(`${d}T00:00:00Z`);
  const toDate = ms => new Date(ms).toISOString().slice(0, 10);
  const addDays = (d, n) => toDate(toMs(d) + n * dayMs);
  const daysBetween = (a, b) => Math.round((toMs(b) - toMs(a)) / dayMs);
  const validDate = d => typeof d === 'string' && DATE_RE.test(d) && toDate(toMs(d)) === d;
  const periodStart = (period, d) => {
    if (period === 'month') return `${d.slice(0, 7)}-01`;
    if (period === 'week') { const wd = (new Date(toMs(d)).getUTCDay() + 6) % 7; return addDays(d, -wd); } // Monday
    return d;
  };
  const MAX_AGE = { shift: 62, day: 62, event: 62, week: 70, month: 100 };
  const STALE_AFTER = { shift: 3, day: 3, event: 14, week: 14, month: 45 };
  function windowFor(periodKey, today) {
    const days = PERIODS[periodKey] || PERIODS.m;
    return { key: PERIODS[periodKey] ? periodKey : 'm', from: addDays(today, -(days - 1)), to: today, days };
  }

  // ---------- record validation (shared: the browser shows the same errors the server enforces) ----------
  function validateRecord(input, today) {
    const errors = [];
    const fail = (field, msg) => { errors.push({ field, error: msg }); };
    if (!input || typeof input !== 'object') return { errors: [{ field: null, error: 'Send a record object.' }] };
    const form = Object.prototype.hasOwnProperty.call(FORMS, input.type) ? FORMS[input.type] : null;
    if (!form) return { errors: [{ field: 'type', error: 'Unknown form.' }] };
    if (!PLANT_IDS.includes(input.plant)) fail('plant', `Plant must be one of ${PLANT_IDS.join(', ')}.`);
    let date = null;
    if (!validDate(input.date)) fail('date', 'Date must be a real date (YYYY-MM-DD).');
    else {
      date = periodStart(form.period, input.date);
      if (daysBetween(today, input.date) > 1) fail('date', 'Date cannot be in the future.');
      else if (daysBetween(date, today) > MAX_AGE[form.period]) fail('date', `Records older than ${MAX_AGE[form.period]} days need an administrator.`);
    }
    const raw = input.data && typeof input.data === 'object' && !Array.isArray(input.data) ? input.data : null;
    if (!raw) return { errors: [...errors, { field: 'data', error: 'Send the form values.' }] };
    const known = new Set(form.fields.map(f => f.k));
    Object.keys(raw).forEach(k => { if (!known.has(k)) fail(k, 'Unknown field.'); });
    const data = {};
    for (const f of form.fields) {
      let v = raw[f.k];
      if (v === undefined || v === null || v === '') { if (f.req) fail(f.k, `${f.label} is required.`); continue; }
      if (f.kind === 'text') {
        if (typeof v !== 'string' || !TEXT_RE.test(v.trim())) { fail(f.k, `${f.label}: 1-40 letters, digits, space or . _ - / # ( ) & +`); continue; }
        data[f.k] = v.trim();
      } else if (f.kind === 'choice') {
        if (!f.options.includes(v)) { fail(f.k, `${f.label} must be one of: ${f.options.join(', ')}.`); continue; }
        data[f.k] = v;
      } else {
        if (f.kind === 'yesno' && typeof v === 'boolean') v = v ? 1 : 0;
        if (!isNum(v)) { fail(f.k, `${f.label} must be a number.`); continue; }
        if (f.kind === 'yesno' && v !== 0 && v !== 1) { fail(f.k, `${f.label}: answer yes or no.`); continue; }
        if (f.kind === 'int' && !Number.isInteger(v)) { fail(f.k, `${f.label} must be a whole number.`); continue; }
        if (v < f.min || v > f.max) { fail(f.k, `${f.label} must be between ${f.min} and ${f.max}${f.unit && f.unit !== 'count' ? ` ${f.unit}` : ''}.`); continue; }
        data[f.k] = v;
      }
    }
    if (!form.fields.some(f => !f.dim && isNum(data[f.k]))) fail(null, 'Enter at least one measured value.');
    if (!errors.length) for (const r of form.rules) { try { if (r.bad(data)) fail(null, r.msg); } catch { fail(null, r.msg); } }
    if (errors.length) return { errors };
    // Normalised so 'RF-12', 'rf 12' and full-width 'ＲＦ12' are one key. A lot, PO or lay number is unique on its own, whatever the date.
    const norm = v => String(v ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const dkey = form.key ? [...(form.period === 'event' && form.key.length ? [] : [date]), ...form.key.map(k => norm(data[k]))].join('|') : null;
    return { errors: [], record: { type: form.id, plant: input.plant, date, data, dkey } };
  }

  // ---------- statistics ----------
  const sum = a => a.reduce((s, x) => s + x, 0);
  const mean = a => (a.length ? sum(a) / a.length : null);
  const variance = a => { if (a.length < 2) return 0; const m = mean(a); return sum(a.map(x => (x - m) ** 2)) / (a.length - 1); };
  const median = a => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

  function lgamma(x) {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, t = x + 5.5, s = 1.000000000190015;
    t -= (x + 0.5) * Math.log(t);
    for (const v of c) s += v / ++y;
    return -t + Math.log(2.5066282746310005 * s / x);
  }
  function betacf(a, b, x) {
    const FPMIN = 1e-300, qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c; h *= del;
      if (Math.abs(del - 1) < 3e-14) break;
    }
    return h;
  }
  function ibeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  /** Two-sided p-value of Student's t. */
  const tPValue = (t, df) => (Number.isFinite(t) && df > 0 ? ibeta(df / (df + t * t), df / 2, 0.5) : null);

  /** Welch's unequal-variance t-test. */
  function welch(a, b) {
    if (a.length < 2 || b.length < 2) return null;
    const m1 = mean(a), m2 = mean(b), s1 = variance(a) / a.length, s2 = variance(b) / b.length, se2 = s1 + s2;
    if (se2 === 0) return { t: m1 === m2 ? 0 : Infinity, df: a.length + b.length - 2, p: m1 === m2 ? 1 : 0, m1, m2 };
    const t = (m1 - m2) / Math.sqrt(se2);
    const df = se2 ** 2 / ((s1 ** 2) / (a.length - 1) + (s2 ** 2) / (b.length - 1));
    return { t, df, p: tPValue(t, df), m1, m2 };
  }

  /** Individuals (XmR) control chart: sigma from the average moving range / 1.128. */
  function controlChart(values) {
    if (!values || values.length < 8) return null;
    const centre = mean(values);
    const mr = values.slice(1).map((v, i) => Math.abs(v - values[i]));
    const sigma = mean(mr) / 1.128;
    const ucl = centre + 3 * sigma, lcl = centre - 3 * sigma;
    const beyond = sigma > 0 ? values.map((v, i) => (v > ucl || v < lcl ? i : -1)).filter(i => i >= 0) : [];
    const side = v => (v > centre ? 1 : v < centre ? -1 : 0);
    let run = null, start = 0;
    for (let i = 1; i <= values.length; i++) {
      if (i < values.length && side(values[i]) !== 0 && side(values[i]) === side(values[start])) continue;
      if (i - start >= 8 && side(values[start]) !== 0) run = { start, end: i - 1, side: side(values[start]) > 0 ? 'above' : 'below' };
      start = i;
    }
    return { centre, sigma, ucl, lcl, beyond, run };
  }

  /** Ordinary least squares slope with its t statistic. points: [[x, y]]. */
  function trend(points) {
    const n = points.length;
    if (n < 6) return null;
    const mx = mean(points.map(p => p[0])), my = mean(points.map(p => p[1]));
    const sxx = sum(points.map(([x]) => (x - mx) ** 2));
    if (sxx === 0) return null;
    const slope = sum(points.map(([x, y]) => (x - mx) * (y - my))) / sxx;
    const resid = sum(points.map(([x, y]) => (y - my - slope * (x - mx)) ** 2));
    const se = Math.sqrt(resid / (n - 2) / sxx);
    const t = se === 0 ? (slope === 0 ? 0 : Infinity * Math.sign(slope)) : slope / se;
    return { slope, t, n, p: Number.isFinite(t) ? tPValue(t, n - 2) : 0 };
  }

  /** Pareto: largest contributors first, with share and cumulative share in %. */
  function pareto(items) {
    const total = sum(items.map(i => i.value));
    let cum = 0;
    return [...items].sort((a, b) => b.value - a.value).map(i => { cum += i.value; return { ...i, share: total ? i.value / total * 100 : 0, cum: total ? cum / total * 100 : 0 }; });
  }

  /** Flags a value far outside this plant's recent history (median ± 5 robust SD). Shown to the approver; never blocks. */
  function outlierFlags(type, data, history) {
    const form = FORMS[type];
    if (!form) return [];
    const flags = [];
    for (const f of form.fields) {
      if (f.dim || f.kind === 'yesno' || !isNum(data[f.k])) continue;
      const past = history.map(h => h[f.k]).filter(isNum);
      if (past.length < 8) continue;
      const med = median(past), mad = median(past.map(v => Math.abs(v - med))) * 1.4826;
      if (mad > 0 && Math.abs(data[f.k] - med) > 5 * mad) flags.push({ field: f.k, msg: `${f.label} ${data[f.k]} is far from the usual ${+med.toFixed(2)} (last ${past.length} records)` });
    }
    return flags;
  }

  // ---------- 3. KPI computation ----------
  function fieldValue(form, data, k) {
    if (k === '#') return 1;
    if (isNum(data[k])) return data[k];
    const fn = form.derive[k];
    if (!fn) return null;
    try { const v = fn(data); return isNum(v) ? v : null; } catch { return null; }
  }

  /** One record's own KPI value (for stratification). */
  function recordValue(kd, rec) {
    const form = FORMS[kd.form];
    if (kd.t === 'ratio') {
      const n = fieldValue(form, rec.data, kd.num), d = fieldValue(form, rec.data, kd.den);
      return n !== null && d ? n / d * kd.scale : null;
    }
    if (kd.t === 'avg') return fieldValue(form, rec.data, kd.v);
    return null;
  }

  /** Days of production the records cover: whole periods for weekly/monthly forms, else since the first record. */
  function spanDays(form, used, win) {
    const plants = new Set(used.map(r => r.plant)).size || 1;
    if (form.period === 'month') return new Set(used.map(r => `${r.plant}|${r.date.slice(0, 7)}`)).size / plants * 30.44;
    if (form.period === 'week') return new Set(used.map(r => `${r.plant}|${r.date}`)).size / plants * 7;
    const first = used.reduce((m, r) => (r.date < m ? r.date : m), win.to);
    return Math.max(1, Math.min(win.days, daysBetween(first, win.to) + 1));
  }

  /** KPI value over a set of records (already filtered to the window and plant). */
  function compute(kd, recs, win) {
    const form = FORMS[kd.form];
    const fv = (r, k) => fieldValue(form, r.data, k);
    let used = [], value = null;
    if (kd.t === 'ratio') {
      used = recs.filter(r => fv(r, kd.num) !== null && fv(r, kd.den) !== null);
      const den = sum(used.map(r => fv(r, kd.den)));
      value = used.length && den > 0 ? sum(used.map(r => fv(r, kd.num))) / den * kd.scale : null;
    } else if (kd.t === 'avg') {
      used = recs.filter(r => fv(r, kd.v) !== null && (!kd.w || fv(r, kd.w) > 0));
      const w = r => (kd.w ? fv(r, kd.w) : 1);
      const tw = sum(used.map(w));
      value = used.length && tw > 0 ? sum(used.map(r => fv(r, kd.v) * w(r))) / tw : null;
    } else if (kd.t === 'sum') {
      used = recs.filter(r => fv(r, kd.v) !== null);
      if (used.length) value = sum(used.map(r => fv(r, kd.v))) * kd.perDays / spanDays(form, used, win);
    } else if (kd.t === 'latest' || kd.t === 'share') {
      const groups = new Map();
      for (const r of recs) {
        if (fv(r, kd.v) === null) continue;
        const g = kd.t === 'share' ? String(r.data[kd.by] || '').toLowerCase() : [r.plant, ...(kd.by || []).map(k => String(r.data[k] || '').toLowerCase())].join('|');
        if (kd.t === 'share' && !g) continue;
        const cur = groups.get(g);
        if (!cur || r.date > cur.date || (r.date === cur.date && (r.id || 0) > (cur.id || 0))) groups.set(g, r);
      }
      used = [...groups.values()];
      const vals = used.map(r => fv(r, kd.v));
      if (vals.length) value = kd.t === 'share' ? mean(vals) * 100 : kd.agg === 'avg' ? mean(vals) : sum(vals);
    }
    const dates = used.map(r => r.date).sort();
    return { value, n: used.length, used, first: dates[0] || null, last: dates[dates.length - 1] || null };
  }

  function describe(kd) {
    if (kd.t === 'combo') return kd.parts.map(([k, s], i) => `${i ? (s > 0 ? ' + ' : ' − ') : ''}${KPIS[k].name}`).join('');
    const form = FORMS[kd.form];
    const lab = k => (k === '#' ? 'records' : (form.fields.find(f => f.k === k) || { label: k.replace(/_/g, ' ') }).label);
    const sc = kd.scale === 1 ? '' : ` × ${kd.scale === 30.44 ? '30.4 days' : kd.scale}`;
    if (kd.t === 'ratio') return kd.den === '#' ? `share of records where "${lab(kd.num)}" = yes` : `Σ ${lab(kd.num)} ÷ Σ ${lab(kd.den)}${sc}`;
    if (kd.t === 'avg') return `average ${lab(kd.v)}${kd.w ? ` weighted by ${lab(kd.w)}` : ''}`;
    if (kd.t === 'sum') return `Σ ${lab(kd.v)} per ${kd.perDays} days`;
    if (kd.t === 'latest') return `latest ${lab(kd.v)}${kd.by ? ` per ${kd.by.join(', ')}` : ' per plant'} (${kd.agg === 'avg' ? 'average' : 'total'})`;
    return `share of ${kd.by}s where "${lab(kd.v)}" = yes`;
  }

  const appliesTo = (key, plant) => plant === 'all' || META[key].plants.includes(plant);

  /** Measured cost of the gap to target, PKR per 30 days, using finance's cost rates. */
  function impactFor(kd, meta, recsByPlant, rateFor, win) {
    if (!kd.impact) return null;
    let total = 0, any = false;
    for (const [plant, recs] of recsByPlant) {
      const rate = rateFor(plant, kd.impact.rate);
      if (rate === null) continue;
      const c = compute(kd, recs, win);
      if (c.value === null) continue;
      any = true;
      const gap = meta.dir === 'up' ? meta.target - c.value : c.value - meta.target;
      if (gap <= 0) continue;
      if (kd.impact.direct) { total += gap * rate * 30 / kd.perDays; continue; }
      const form = FORMS[kd.form];
      const base = sum(c.used.map(r => fieldValue(form, r.data, kd.impact.base) || 0)) * 30 / spanDays(form, c.used, win);
      total += gap / 100 * base * rate;
    }
    return any ? Math.round(total) : null;
  }

  const fmtN = v => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : +v.toFixed(Math.abs(v) >= 10 ? 1 : 2));

  /**
   * The dashboard's ground truth. records: APPROVED records [{id, type, plant, date, data}].
   * Returns every KPI as measured (value) or not (value null), coverage, and ranked findings with evidence.
   */
  function measureAll(records, { plant = 'all', period = 'm', today }) {
    const win = windowFor(period, today);
    const inScope = r => (plant === 'all' || r.plant === plant);
    const inWin = records.filter(r => r.date >= win.from && r.date <= win.to && inScope(r));
    const byForm = new Map();
    for (const r of inWin) { if (!byForm.has(r.type)) byForm.set(r.type, []); byForm.get(r.type).push(r); }
    const rates = new Map(); // plant -> latest cost rates (standing figures, so the window does not apply)
    const rateRecs = records.filter(x => x.type === 'cost_rates').sort((a, b) => (a.date === b.date ? (a.id || 0) - (b.id || 0) : a.date < b.date ? -1 : 1));
    for (const r of rateRecs) rates.set(r.plant, { ...(rates.get(r.plant) || {}), ...r.data });
    const rateOf = (p, k) => (rates.get(p) && isNum(rates.get(p)[k]) ? rates.get(p)[k] : null);
    const rateFor = (p, k) => rateOf(p, k) ?? rateOf('GRP', k);

    const kpis = {};
    const keys = Object.keys(KPIS);
    for (const key of keys.filter(k => KPIS[k].t !== 'combo')) {
      const kd = KPIS[key], meta = META[key], form = FORMS[kd.form];
      const recs = byForm.get(kd.form) || [];
      const c = compute(kd, recs, win);
      const stale = c.last ? daysBetween(c.last, win.to) > STALE_AFTER[form.period] : false;
      const days = new Map();
      for (const r of c.used) { if (!days.has(r.date)) days.set(r.date, []); days.get(r.date).push(r); }
      const series = [...days.keys()].sort().map(d => [d, compute(kd, days.get(d), { ...win, from: d, to: d, days: 1 }).value]).filter(p => p[1] !== null);
      const byPlant = new Map();
      for (const r of recs) { if (!byPlant.has(r.plant)) byPlant.set(r.plant, []); byPlant.get(r.plant).push(r); }
      kpis[key] = {
        key, sec: kd.sec, name: kd.name, unit: meta.unit, target: meta.target, dir: meta.dir, applicable: appliesTo(key, plant),
        value: c.value === null ? null : +c.value.toFixed(4), n: c.n, first: c.first, last: c.last, stale,
        status: c.value === null ? 'unknown' : TA.RCA.status(c.value, meta.target, meta.dir),
        form: kd.form, formLabel: form.label, formula: describe(kd), series: series.slice(-60),
        impactPkr: impactFor(kd, meta, byPlant, rateFor, win), _used: c.used,
      };
    }
    for (const key of keys.filter(k => KPIS[k].t === 'combo')) {
      const kd = KPIS[key], meta = META[key];
      const parts = kd.parts.map(([k, s]) => [kpis[k], s]);
      const ok = parts.every(([p]) => p.value !== null);
      const value = ok ? sum(parts.map(([p, s]) => p.value * s)) : null;
      const lasts = parts.map(([p]) => p.last).filter(Boolean).sort();
      kpis[key] = {
        key, sec: kd.sec, name: kd.name, unit: meta.unit, target: meta.target, dir: meta.dir, applicable: appliesTo(key, plant),
        value: value === null ? null : +value.toFixed(4), n: ok ? Math.min(...parts.map(([p]) => p.n)) : 0, first: null, last: ok ? lasts[0] : null,
        stale: ok && parts.some(([p]) => p.stale), status: value === null ? 'unknown' : TA.RCA.status(value, meta.target, meta.dir),
        form: null, formLabel: [...new Set(parts.map(([p]) => p.formLabel))].join(' + '), formula: describe(kd), series: [], impactPkr: null, _used: [],
      };
    }

    // coverage
    const bySection = {};
    let applicable = 0, measured = 0;
    for (const k of keys) {
      const x = kpis[k];
      if (!x.applicable) continue;
      bySection[x.sec] = bySection[x.sec] || { measured: 0, applicable: 0 };
      bySection[x.sec].applicable++; applicable++;
      if (x.value !== null) { bySection[x.sec].measured++; measured++; }
    }
    const coverage = { measured, applicable, pct: applicable ? Math.round(measured / applicable * 1000) / 10 : 0, bySection, records: inWin.length };

    // findings: every measured KPI that misses its target, with statistical evidence
    const findings = [];
    for (const k of keys) {
      const x = kpis[k];
      if (x.value === null || !x.applicable || x.status === 'good') continue;
      const gapPct = Math.abs(x.value - x.target) / (Math.abs(x.target) || 1) * 100;
      findings.push({ key: k, sec: x.sec, name: x.name, value: x.value, target: x.target, unit: x.unit, dir: x.dir, status: x.status, n: x.n, gapPct: +gapPct.toFixed(1), impactPkr: x.impactPkr, evidence: evidence(KPIS[k], x, byForm, win), hypotheses: hypotheses(k) });
    }
    findings.sort((a, b) => ((b.impactPkr || 0) - (a.impactPkr || 0)) || ((b.status === 'bad') - (a.status === 'bad')) || (b.gapPct - a.gapPct));
    for (const k of keys) delete kpis[k]._used;
    return { plant, period: win, source: 'approved department records', kpis, coverage, findings };
  }

  function evidence(kd, x, byForm, win) {
    const ev = [];
    const worse = v => (x.dir === 'up' ? v < 0 : v > 0);
    const u = x.unit === '%' ? '%' : x.unit ? ` ${x.unit}` : '';
    ev.push({ kind: 'measure', text: `Measured ${fmtN(x.value)}${u} from ${x.n} approved record${x.n === 1 ? '' : 's'}${x.first ? ` (${x.first} to ${x.last})` : ''}; target ${x.target}${u}.${x.stale ? ' No new records recently: the value may be out of date.' : ''}` });
    if (kd.t === 'combo') { ev.push({ kind: 'formula', text: `Calculated as ${describe(kd)}.` }); return ev; }
    const vals = x.series.map(p => p[1]);
    const cc = controlChart(vals);
    if (cc) {
      const badRun = cc.run && ((cc.run.side === 'below') === (x.dir === 'up'));
      if (cc.beyond.length || badRun) {
        const parts = [];
        if (cc.beyond.length) parts.push(`${cc.beyond.length} point${cc.beyond.length > 1 ? 's' : ''} outside the 3-sigma limits (${fmtN(cc.lcl)}–${fmtN(cc.ucl)}), latest on ${x.series[cc.beyond[cc.beyond.length - 1]][0]}`);
        if (badRun) parts.push(`${cc.run.end - cc.run.start + 1} points in a row ${cc.run.side} the average from ${x.series[cc.run.start][0]}`);
        ev.push({ kind: 'control', signal: true, text: `Special cause: ${parts.join('; ')}. Something changed, so find out what happened on those dates.` });
      } else {
        ev.push({ kind: 'control', signal: false, text: `Stable process: no control-chart signals in ${vals.length} points (average ${fmtN(cc.centre)}, limits ${fmtN(cc.lcl)}–${fmtN(cc.ucl)}). The gap is built into the system. Change the method, machine or material; do not chase single days.` });
      }
    }
    const tr = trend(x.series.map(([d, v]) => [daysBetween(win.from, d), v]));
    if (tr && Math.abs(tr.t) >= 2) ev.push({ kind: 'trend', worsening: worse(tr.slope), text: `${worse(tr.slope) ? 'Getting worse' : 'Improving'} by ${fmtN(Math.abs(tr.slope * 7))}${u} per week (t = ${tr.t.toFixed(1)}, ${tr.n} points).` });
    const st = stratify(kd, x);
    if (st) ev.push({ kind: 'stratify', dim: st.dim, level: st.level, p: st.p, text: `${st.label} "${st.level}" is worst: ${fmtN(st.mean)}${u} vs ${fmtN(st.rest)}${u} elsewhere (Welch p = ${st.p < 0.001 ? '<0.001' : st.p.toFixed(3)}, ${st.n} vs ${st.restN} records).` });
    const pc = PARETO[x.key];
    if (pc) {
      const recs = (byForm.get(pc.form) || []).filter(r => !pc.area || r.data.area === pc.area);
      if (recs.length >= 3) {
        const agg = new Map();
        for (const r of recs) agg.set(r.data[pc.by], (agg.get(r.data[pc.by]) || 0) + (r.data[pc.w] || 0));
        const p = pareto([...agg].map(([label, value]) => ({ label, value })));
        const top = p.slice(0, Math.max(1, p.findIndex(i => i.cum >= 80) + 1)).slice(0, 3);
        ev.push({ kind: 'pareto', items: p.slice(0, 6).map(i => ({ label: i.label, value: i.value, share: +i.share.toFixed(1) })), text: `Pareto of ${recs.length} ${FORMS[pc.form].label.toLowerCase()} records: ${top.map(i => `${i.label} ${Math.round(i.share)}%`).join(', ')} (${Math.round(top[top.length - 1].cum)}% of ${pc.unit}).` });
      }
    }
    if (x.impactPkr) ev.push({ kind: 'impact', text: `Measured cost of the gap: PKR ${Math.round(x.impactPkr).toLocaleString('en-US')} per 30 days, at finance's cost rate.` });
    return ev;
  }

  function stratify(kd, x) {
    if (kd.t !== 'ratio' && kd.t !== 'avg') return null;
    const dims = FORMS[kd.form].fields.filter(f => f.dim);
    let best = null;
    for (const f of dims) {
      const groups = new Map();
      for (const r of x._used) {
        const lvl = r.data[f.k], v = recordValue(kd, r);
        if (lvl === undefined || v === null) continue;
        if (!groups.has(lvl)) groups.set(lvl, []);
        groups.get(lvl).push(v);
      }
      if (groups.size < 2) continue;
      for (const [lvl, vals] of groups) {
        const rest = [...groups].filter(([l]) => l !== lvl).flatMap(([, v]) => v);
        if (vals.length < 5 || rest.length < 5) continue;
        const w = welch(vals, rest);
        if (!w || w.p === null || w.p >= 0.05) continue;
        const diff = w.m1 - w.m2;
        if (x.dir === 'up' ? diff >= 0 : diff <= 0) continue; // only the worse stratum points to a cause
        if (!best || Math.abs(diff) > Math.abs(best.mean - best.rest)) best = { dim: f.k, label: f.label, level: lvl, mean: w.m1, rest: w.m2, n: vals.length, restN: rest.length, p: w.p };
      }
    }
    return best;
  }

  function hypotheses(key) {
    return D.FINDINGS.filter(f => (FINDING_KPI[f.id] || `${f.sec}|${f.kpi && f.kpi.name}`) === key).map(f => ({ id: f.id, title: f.title }));
  }

  // ---------- 4. who may use which form ----------
  const FINANCE_DEPTS = ['finance', 'inventory', 'procurement'];
  /** Forms a user may submit. CEO, plant heads and integration feeds may use every form. */
  function formsFor(user) {
    if (!user) return [];
    const all = Object.keys(FORMS);
    if (['ceo', 'plant', 'integration'].includes(user.role)) return all;
    if (user.role === 'finance') return all.filter(id => FORMS[id].depts.some(d => FINANCE_DEPTS.includes(d)));
    if (user.role === 'dept' || user.role === 'operator') return user.department ? all.filter(id => FORMS[id].depts.includes(user.department)) : [];
    return [];
  }
  /** Forms whose records a user may approve. Nobody approves their own record (the server checks that too). */
  function reviewableForms(user) {
    if (!user || ['operator', 'admin', 'integration'].includes(user.role)) return [];
    return formsFor(user);
  }
  const formForKpi = key => (KPIS[key] && KPIS[key].form ? FORMS[KPIS[key].form] : null);

  const api = {
    FORMS, KPIS, META, PLANT_IDS, DEPARTMENTS, PERIODS, PARETO, FINDING_KPI, validateRecord, measureAll, compute, describe, windowFor, periodStart,
    formsFor, reviewableForms, formForKpi, outlierFlags,
    stats: { mean, variance, median, welch, tPValue, controlChart, trend, pareto }, dates: { addDays, daysBetween, validDate },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TM = api;
})(typeof window !== 'undefined' ? window : globalThis);
