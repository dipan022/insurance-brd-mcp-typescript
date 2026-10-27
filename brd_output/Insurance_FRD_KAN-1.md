# Functional Requirement Document  

## 1. Document Overview  
- **Purpose**: Capture detailed functional requirements derived directly from the Business Requirement Document (BRD) for the Insurance Policy Management System.  
- **Scope**: Covers all **in‑scope** capabilities (customer & policy management, premium calculation, renewal workflow, self‑service, agent updates, security, audit, and reporting) while excluding out‑of‑scope items such as claims processing, payment collection, advanced underwriting, and mobile native apps.  
- **Document Revision**: Initial version, aligned with the approved BRD v1.0.  

## 2. System Overview  
The system is a web‑based policy management platform that provides:  

1. **Customer Management Module** – profiles, contact details, audit trail.  
2. **Policy Management Module** – creation, amendment, status tracking, renewal processing.  
3. **Premium Calculation Engine** – applies business rules to generate premium amounts.  
4. **Self‑Service Portal** – policyholder view, renewal request, status checks.  
5. **Agent Interface** – policy creation, updates, and status management.  
6. **Administration Console** – user/role management, security policies, system monitoring.  
All components are hosted in a secure cloud environment with TLS 1.2+, AES‑256 encryption at rest, MFA, and RBAC.  

## 3. Actors  

| Actor | Primary Role | Permissions |
|-------|--------------|-------------|
| **Policyholder** | End customer who purchases insurance. | View own active policy, request renewal, update own contact information (via self‑service portal). |
| **Agent** | Licensed sales representative. | Create/update customer profiles, create/amend policies, trigger renewals, view related customers. |
| **Administrator** | System admin / IT operations. | Manage users & roles, enforce security policies, audit logs, system health monitoring. |

## 4. Functional Requirements  

| FFR ID | Description | Source BRD FR ID |
|--------|-------------|------------------|
| **FFR-001** | Create a customer/policyholder profile with mandatory fields (Name, Address, Contact Information, Identification Number). | FR-001 |
| **FFR-002** | Update existing customer profile details (address, phone, email) with an immutable audit trail. | FR-002 |
| **FFR-003** | Create an insurance policy record that includes Policy Number, Effective Dates, Coverage Type, Limits, Deductibles, and the associated Customer. | FR-003 |
| **FFR-004** | Calculate premium amount based on coverage selections, risk factors, and applicable rates. | FR-004 |
| **FFR-005** | Record the calculated premium and generate a payment schedule (installments or single payment). | FR-005 |
| **FFR-006** | Provide a secure view for policyholders to display active policy details (coverage, limits, premium, status). | FR-006 |
| **FFR-007** | Initiate a renewal workflow: generate renewal notice 30 days before expiration, allow acceptance or change requests, recalculate premium, and issue a renewed policy record. | FR-007 |
| **FFR-008** | Allow agents to modify policy information (coverage adjustments, personal details) with role‑based access control and audit logging. | FR-008 |
| **FFR-009** | Maintain the **Policy Status** field with values *Active*, *Expired*, *Cancelled*, *Renewed*; automatically transition status based on dates or manual actions. | FR-009 |
| **FFR-010** | Store all customer and policy data encrypted at rest and in transit; enforce authentication and authorization for all access. | FR-010 |

## 5. Detailed Functional Flows  

### 5.1 Create Customer Profile (FFR‑001)  
1. Agent accesses **Customer Management** screen.  
2. Selects **New Profile**.  
3. Enters mandatory fields (Name, Address, Phone, Email, ID Number).  
4. System validates required fields and format.  
5. Upon validation, system generates a unique **CustomerID**, timestamps **CreatedDate**, stores encrypted profile, and logs creation in **AuditLog**.  
6. Confirmation message displayed; profile appears in **Customer List**.  

### 5.2 Update Customer Profile (FFR‑002)  
1. Agent selects an existing profile → **Edit** mode.  
2. Modifies allowed fields (Address, Phone, Email).  
3. System validates changes (e.g., email format).  
4. Saves updated profile; records **ChangedFields**, **UserID**, **Timestamp** in **AuditLog**.  
5. Updated details reflected immediately for all linked agents.  

### 5.3 Create Policy (FFR‑003)  
1. Agent selects target customer → **Create Policy**.  
2. System auto‑generates a unique **PolicyID** (e.g., POL‑YYYY‑XXXX).  
3. Agent selects **Coverage Type**, enters **Limit**, **Deductible**, **EffectiveDate**, **EndDate**.  
4. System validates limits against product definitions.  
5. Policy record saved, linked to CustomerID, status set to **Active**, and entry created in **PremiumCalculation** (pending).  
6. Confirmation displayed; policy appears in policy list.  

### 5.4 Premium Calculation (FFR‑004)  
1. After policy creation (or amendment), the **Premium Engine** is invoked.  
2. Engine reads: **Base Rate**, **CoverageFactor**, **RiskMultiplier** (derived from policy data & risk model).  
3. Applies formula: **Premium = Base Rate × Coverage Factor × Risk Multiplier** (Business Rule 1).  
4. System validates calculated premium within ± 1 % of actuarial rate (FR‑004 acceptance).  
5. Resulting premium stored in **PremiumCalculation** and **Policy** table.  

### 5.5 Record Premium & Payment Schedule (FFR‑005)  
1. System persists the calculated premium to **Policy** (Premium field) and creates a **PremiumCalculation** entry.  
2. Generates **Payment Schedule**: either a single due date (if premium ≤ threshold) or multiple installment dates based on configurable policy terms.  
3. Schedule stored in **PremiumSchedule** table (out‑of‑scope payment processing).  
4. Output displayed to agent: “Premium $X.XX – Y installments due on [dates]”.  

### 5.6 Policyholder View Policy (FFR‑006)  
1. Policyholder logs in via identity provider.  
2. System enforces MFA for privileged users; RBAC grants view access to the policyholder’s own policies only.  
3. System queries **Policy** table for records where **CustomerID** matches logged‑in user and **Status = Active**.  
4. Details retrieved: PolicyID, Coverage, Limits, Deductible, Premium, Status, Effective/End dates.  
5. Sensitive fields (IDNumber) masked per security rule.  
6. Page rendered with read‑only view; non‑active policies are excluded.  

### 5.7 Renewal Workflow (FFR‑007)  
1. System monitors **EndDate** of all policies; 30 days prior generates **RenewalNotice** (email via Email Service).  
2. Notification includes policy details, upcoming expiration, and a “Renew Now” link.  
3. Policyholder clicks link → **Renewal Request** form appears.  
4. Policyholder can **Accept** (keep same terms) or **Request Changes** (adjust coverage, limits).  
5. If changes requested, agent receives a **RenewalWorkItem**; agent reviews, updates policy (FFR‑008), re‑runs premium calculation (FFR‑004), and confirms renewal.  
6. Upon acceptance or agent completion, system creates a **New Policy** record (FFR‑003) linked to original **OriginalPolicyID**, status set to **Renewed**, and new premium recorded (FFR‑005).  
7. Original policy status set to **Renewed**; new policy becomes **Active**.  

### 5.8 Agent Policy Update (FFR‑008)  
1. Agent selects a policy → **Edit**.  
2. Allowed fields: Coverage adjustments, Limits, Deductibles, Personal details (linked to customer).  
3. System validates against business rules (coverage limit caps, eligibility).  
4. Changes persisted; policy status remains **Active** (or transitions per FFR‑009 if cancellation).  
5. Full audit log entry created (FFR‑002 style).  

### 5.9 Policy Status Management (FFR‑009)  
- **Automated Transition**: Scheduler runs daily; if current date > **EndDate** and status = **Active**, update status to **Expired**.  
- **Manual Cancellation**: Agent/Admin selects policy → **Cancel**; status updated to **Cancelled** with reason; audit log captured.  
- **Renewal Transition**: Once renewal creates a new policy, both original and new records are stamped **Renewed**.  
- All transitions recorded in **AuditLog**.  

### 5.10 Data Security (FFR‑010)  
1. All inbound/outbound traffic forced through TLS 1.2+ (Integration Requirement).  
2. Data at rest encrypted using AES‑256 (Key Management Service).  
3. Authentication: MFA for all user types via Identity Provider (SAML/OAuth).  
4. Authorization: Role‑based matrix (Policyholder, Agent, Admin) enforced at service layer.  
5. Access attempts logged in immutable **AuditLog**; unauthorized requests return 403.  

## 6. Business Rules  

1. **Premium Calculation**: `Premium = Base Rate × Coverage Factor × Risk Multiplier`.  
2. **Status Transitions**:  
   - *Active* → *Expired* (automatic on end date).  
   - *Active* → *Cancelled* (manual by agent or admin).  
   - *Expired* → *Renewed* (upon successful renewal).  
3. **Renewal Eligibility**: Policy must be within 30 days of expiration to initiate renewal.  
4. **Coverage Limits**: Maximum limit per coverage type enforced per product definition.  
5. **Audit Trail**: Any change to policy or customer data must be logged with User ID, Timestamp, and field changes.  

## 7. Input Requirements  

| Input | Source (FFR) | Description |
|-------|--------------|-------------|
| Customer Name, Address, Phone, Email, IDNumber | FFR‑001, FFR‑002 | Mandatory profile data. |
| Coverage Type, Limit, Deductible, EffectiveDate, EndDate | FFR‑003 | Policy creation data. |
| Coverage selections, Risk factors, Rate tables | FFR‑004 | Premium calculation inputs. |
| Premium amount, Payment schedule preferences | FFR‑005 | Recording of premium and schedule. |
| Login credentials (username/password + MFA token) | FFR‑006, FFR‑007, FFR‑008, FFR‑010 | Authentication. |
| Renewal acceptance or change requests (coverage adjustments) | FFR‑007 | Renewal workflow inputs. |
| Policy amendment fields (limit, deductible, etc.) | FFR‑008 | Update inputs. |
| Cancellation reason, user ID | FFR‑009 | Status change inputs. |
| Security tokens, audit data (user, timestamp, changed fields) | FFR‑010 | Security & audit inputs. |

## 8. Output Requirements  

| Output | Generated By | Description |
|--------|--------------|-------------|
| Unique **CustomerID** confirmation | FFR‑001 | Acknowledgement of created profile. |
| Updated **Customer** record view | FFR‑002 | Display of modified details. |
| Unique **PolicyID** and policy summary | FFR‑003 | Confirmation of policy creation. |
| Calculated **Premium** amount and breakdown (Base Rate, Coverage Factor, Risk Multiplier) | FFR‑004 | Transparent premium calculation. |
| Payment schedule list (dates & amounts) | FFR‑005 | Output for agent & policyholder. |
| Encrypted policy data (read‑only) | FFR‑006 | Policyholder view of active policy. |
| Renewal notice email (via Email Service) | FFR‑007 | Notification of upcoming expiration. |
| New **PolicyID** and updated status for renewed policy | FFR‑007 | Confirmation of renewal. |
| Updated **Policy** details after amendment | FFR‑008 | Confirmation of changes. |
| Status transition events (system‑generated logs) | FFR‑009 | Internal audit trail. |
| Security compliance report (encryption status, audit logs) | FFR‑010 | Output for admin monitoring. |
| Audit log entries (immutable) | All FRs | Immutable change records. |

## 9. Validation Rules  

| Rule | Input Validation | Condition |
|------|------------------|-----------|
| Mandatory fields present | FFR‑001, FFR‑003 | Non‑empty strings for Name, Address, IDNumber, Coverage Type, Limit, Deductible. |
| Email format | FFR‑001, FFR‑002 | Must match regex `^[^@]+@[^@]+\.[^@]+$`. |
| IDNumber uniqueness | FFR‑001 | System checks against existing customers; duplicate rejected. |
| Coverage limit compliance | FFR‑003 | Entered limit ≤ product‑defined maximum. |
| Premium range | FFR‑004 | Calculated premium must be positive and within ± 1 % of actuarial rate (acceptance). |
| Payment schedule date logic | FFR‑005 | Installment dates after effective date; no duplicate dates. |
| Policy status consistency | FFR‑009 | Status transitions only follow defined rules (Active→Expired/Cancelled, Expired→Renewed). |
| Access authorization | FFR‑006‑FFR‑010 | User role matches permission matrix; unauthorized access returns 403. |
| Encryption compliance | FFR‑010 | All stored fields encrypted; API calls use TLS 1.2+. |

## 10. Error Handling  

| Scenario | Error Message | Recovery Action |
|----------|---------------|-----------------|
| Duplicate Customer IDNumber | “Customer with this identification number already exists.” | Prompt user to verify or provide alternative ID. |
| Invalid email format | “Invalid email address entered.” | Re‑ask for email, provide format hint. |
| Coverage limit exceeded | “Entered limit exceeds product maximum.” | Offer to reduce limit or select different product. |
| Premium calculation out of range | “Calculated premium deviates beyond ± 1 % of actuarial rate.” | Review risk factor inputs; re‑run calculation. |
| Missing MFA token | “Multi‑factor authentication failed.” | Request token again; lock account after 3 failures. |
| Unauthorized policy view | “You are not authorized to view this policy.” | Redirect to home page; log event. |
| System timeout during premium calc | “Premium calculation timed out. Please try again.” | Retry with simplified risk profile; notify admin. |
| Database connection failure | “Service temporarily unavailable.” | Display user‑friendly message; implement retry with exponential backoff; alert operations. |

## 11. Access Control  

| Role | Permissions |
|------|-------------|
| **Policyholder** | - View own active policies (FFR‑006). <br> - Initiate renewal (FFR‑007). <br> - Update own contact info (FFR‑002). |
| **Agent** | - Create/Read/Update Customer profiles (FFR‑001, FFR‑002). <br> - Create/Read/Update Policies (FFR‑003, FFR‑008). <br> - Run premium calculation (FFR‑004) and record premium (FFR‑005). <br> - Manage renewal workflow (FFR‑007). |
| **Administrator** | - Manage user accounts & roles. <br> - Configure security policies (MFA, encryption). <br> - Access audit logs & system health. <br> - Perform manual status changes (FFR‑009). |
| **All Roles** | - TLS‑protected communication, MFA (FFR‑010). <br> - Audit logging of all actions. <br> - Data masking of sensitive fields for non‑privileged views. |

## 12. Integration Requirements  

| Integration Point | Purpose | Interface |
|-------------------|---------|-----------|
| **Identity Provider (SAML/OAuth)** | User authentication, SSO, MFA enforcement. | SAML 2.0 / OAuth 2.0 tokens. |
| **Email Service** | Send renewal notices, confirmations, policy updates. | RESTful API (SMTP wrapper). |
| **Document Storage Service** | Store policy certificates, PDFs, supporting docs (basic storage). | Cloud storage (S3‑compatible) with signed URLs. |
| **Payment Gateway (External)** | Premium transaction processing (out‑of‑scope for functional scope). | Payment API (PCI‑DSS compliant). |
| **Audit / Logging Service** | Immutable, centralized audit logs. | Syslog / ELK stack. |
| **Key Management Service** | Encryption key rotation for AES‑256. | KMS API. |
| **Scheduler/Job Service** | Daily status transition jobs, renewal notice generation. | Cron‑based jobs. |

All integrations must be over TLS 1.2+, use mutual TLS where required, and include error handling and retry logic.

## 13. Data Requirements  

| Entity | Key Attributes | Description |
|--------|----------------|-------------|
| **Customer** | CustomerID (PK), Name, Address, Phone, Email, IDNumber, CreatedDate, UpdatedDate, UpdatedBy | Encrypted storage; audit trail on updates. |
| **Policy** | PolicyID (PK), CustomerID (FK), CoverageType, Limit, Deductible, EffectiveDate, EndDate, Premium, Status, CreatedDate, UpdatedDate, UpdatedBy | Status managed per business rules; linked to Customer. |
| **PremiumCalculation** | CalculationID (PK), PolicyID (FK), BaseRate, CoverageFactor, RiskMultiplier, ResultingPremium, CalculationDate | Historical record for audit & reporting. |
| **Renewal** | RenewalID (PK), OriginalPolicyID (FK), NewPolicyID (FK), RenewalDate, PremiumAdjustment | Tracks renewal events. |
| **AuditLog** | LogID (PK), Entity (e.g., “Customer”), EntityID, Action (Create/Update/Delete), ChangedFields (JSON), UserID, Timestamp | Immutable append‑only log. |
| **PaymentSchedule** | ScheduleID (PK), PolicyID (FK), InstallmentNumber, DueDate, Amount | Populated by FFR‑005 (out‑of‑scope payment processing). |

All data fields are stored encrypted at rest; sensitive fields (e.g., IDNumber) are masked in UI for non‑admin roles.

## 14. Acceptance Criteria  

| ID | Criterion |
|----|-----------|
| **AC‑001** | System must allow creation of a customer profile with all mandatory fields; profile is saved and assigned a unique identifier. |
| **AC‑002** | Updating a customer profile must record the change in an audit log with timestamp and user ID. |
| **AC‑003** | A policy can be created only after selecting valid coverage options; policy number must be auto‑generated and unique. |
| **AC‑004** | Premium calculation must produce a numeric value within ± 1 % of the actuarial rate for given coverage and risk profile. |
| **AC‑005** | Recorded premium must be visible in the policy detail view and stored in the database. |
| **AC‑006** | Policyholder with valid credentials can view their active policy details; non‑active policies are hidden. |
| **AC‑007** | Renewal workflow must generate a notice 30 days before expiration; acceptance must create a new policy record with updated dates and premium. |
| **AC‑008** | Agent with appropriate permissions can edit policy fields; changes are persisted and reflected in subsequent views. |
| **AC‑009** | Policy status must automatically change to *Expired* when current date > end date; manual cancellation must set status to *Cancelled*. |
| **AC‑010** | All data transmissions must use TLS 1.2+; data at rest must be encrypted with AES‑256; access must require multi‑factor authentication for privileged users. |

## 15. Traceability Matrix  

| FFR ID | Source BRD FR ID | Acceptance Criteria(s) |
|--------|------------------|------------------------|
| **FFR‑001** | FR‑001 | AC‑001 |
| **FFR‑002** | FR‑002 | AC‑002 |
| **FFR‑003** | FR‑003 | AC‑003 |
| **FFR‑004** | FR‑004 | AC‑004 |
| **FFR‑005** | FR‑005 | AC‑005 |
| **FFR‑006** | FR‑006 | AC‑006 |
| **FFR‑007** | FR‑007 | AC‑007 |
| **FFR‑008** | FR‑008 | AC‑008 |
| **FFR‑009** | FR‑009 | AC‑009 |
| **FFR‑010** | FR‑010 | AC‑010 |

All functional requirements are directly traceable to the BRD functional requirements and the associated acceptance criteria.  

---  

*End of Functional Requirement Document.*