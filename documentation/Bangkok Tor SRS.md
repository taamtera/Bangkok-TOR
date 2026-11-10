#  Software Requirement Specification


### Bangkok TOR

- Contractor:
  - Taam Paramee 6610545316
  - Nattanan Pimjaipong 6710545601
  - Mohammed Saad Ahmed Ghaleb Al-Shurim 6910042832
  - Peerawat Theerasakul 6610545880


- Group Name: BKKTOR

- Client:
  - Prof. Dr. Sirisilp Kongsilp

- Course:
  - Collaborative Software Process

23rd August 2026

# Table of Contents

[**1.Introduction	3**](#1.introduction)

[1.1.Purpose	3](#1.1.purpose)

[1.2.Scope	3](#1.2.scope)

[1.3.Intended Audience	4](#1.3.intended-audience)

[**2\. Overall Description	4**](#2.-overall-description)

[2.1.Product Perspective (Product Purpose)	4](#2.1.product-perspective-\(product-purpose\))

[2.2.User classes and characteristics	4](#2.2.user-classes-and-characteristics)

[2.3.Dependencies	5](#2.3.dependencies)

[2.4.Out of Scope	6](#2.4.out-of-scope)

[2.5.Assumptions	6](#2.5.assumptions)

[**3.Stakeholders	7**](#3.stakeholders)

[3.1.Development	7](#3.1.development)

[3.2.Users	7](#3.2.users)

[**4\. User Stories	8**](#4.-user-stories)

[**5\. System Features	9**](#5.-system-features)

[5.1. TOR Website Crawlers and Dashboard	9](#5.1.-tor-website-crawlers-and-dashboard)

[5.2. Registration Feature	9](#5.2.-registration-feature)

[5.3. Software House's Profile	9](#5.3.-software-house's-profile)

[5.4. TOR Evaluation	9](#5.4.-tor-evaluation)

[5.5. TOR Matching	9](#5.5.-tor-matching)

[**6\. Non-Functional Requirements	10**](#6.-non-functional-requirements)

[**7\. Use Case Modeling	11**](#7.-use-case-modeling)

[7.1. Use case model	11](#7.1.-use-case-model)

[7.2. Dressed up use case — search and filter TOR	21](#7.2.-dressed-up-use-case-—-search-and-filter-tor)

[7.3. Casual use case — Crawl TOR contracts	23](#7.3.-casual-use-case-—-crawl-tor-contracts)

[7.4. Casual use case — Login	23](#7.4.-casual-use-case-—-login)

[7.5. Casual use case — Reset password	24](#7.5.-casual-use-case-—-reset-password)

[7.6. Casual use case — Evaluate TOR	24](#7.6.-casual-use-case-—-evaluate-tor)

[7.7. Casual use case — Notify match	25](#7.7.-casual-use-case-—-notify-match)

[**8\. Requirements Traceability Matrix	26**](#8.-requirements-traceability-matrix)

# 

# 1.Introduction {#1.introduction}

## 1.1.Purpose {#1.1.purpose}

The purpose of this system is to provide a centralized platform for discovering, storing, evaluating, and matching Terms of Reference (TOR) contracts in Bangkok with suitable Software Houses and Freelancers.

The system will collect TOR information from relevant online sources and present it in one place, allowing Software Houses to search, filter, and evaluate available contracts more efficiently. The system will also use AI to analyze TOR requirements, pricing, and Software House qualifications in order to identify suitable matches.

## 1.2.Scope {#1.2.scope}

The system covers the discovery and management of TOR contracts available online within Bangkok. The main scope of the system includes:

* Crawling relevant websites to discover TOR contracts.  
* Storing TOR contract information in the system.  
* Displaying TOR contracts to registered Software Houses.  
* Grouping and filtering TOR contracts.  
* Allowing Software Houses to register and manage their accounts.  
* Allowing Software Houses to create and manage their company information and qualifications.  
* Using AI to evaluate TOR requirements and pricing.  
* Using AI to evaluate Software House qualifications.  
* Matching Software Houses with suitable TOR contracts.  
* Notifying Software Houses when suitable TOR contracts are found.  
* Maintaining the latest available version of TOR information.  
* Protecting Software House information from unauthorized access.

The system does not directly submit bids or proposals to TOR Owners. It primarily acts as a platform for discovering, evaluating, and matching TOR opportunities.

## 

## 1.3.Intended Audience {#1.3.intended-audience}

This document is intended for the following stakeholders:

* Project Owner (Prof. Dr. Sirisilp Kongsilp) – responsible for defining project objectives, evaluating the system, and reviewing TOR information.  
* Developers (Ant, Taam, Mohammed) – responsible for designing, developing, testing, and maintaining the system.

# 2\. Overall Description {#2.-overall-description}

## 2.1.Product Perspective (Product Purpose) {#2.1.product-perspective-(product-purpose)}

The application being developed is an AI-powered, web-based TOR discovery and matching platform designed to help Software Houses and Freelancers find suitable Terms of Reference (TOR) contracts in Bangkok.

Currently, TOR contracts can be published across multiple websites and platforms, requiring Software Houses to manually search through different sources to find suitable opportunities. The application aims to centralize these TOR contracts into one platform, allowing users to search, filter, group, and review available TOR contracts more efficiently.

The system will use automated web crawling to collect TOR information from relevant online sources and store the information within the system. Google Vertex AI will be used to analyze the collected TOR information, evaluate TOR requirements and pricing, evaluate Software House qualifications, and identify potential matches between Software Houses and TOR contracts.

The main goal of the application is to make TOR opportunities more publicly accessible and reduce the time and effort required for Software Houses to discover suitable contracts, while also minimizing unnecessary requests to external TOR hosting websites and unnecessary AI usage.

## 2.2.User classes and characteristics {#2.2.user-classes-and-characteristics}

There are three main types of users and external stakeholders: Software Houses, TOR Owners, and the Project Owner.

For Software Houses, the primary user flow focuses on discovering suitable TOR contracts, managing their company information and qualifications, and receiving recommendations for TORs that match- their capabilities. Software Houses can register, log in, manage their profiles, search and filter TOR contracts, and receive notifications when suitable TORs are identified.

For TOR Owners, the main interaction with the system is indirect. TOR Owners publish their TOR contracts through external TOR hosting websites, from which the application collects publicly available information. Their main interest is to have their TOR contracts discovered by qualified Software Houses.

For the Project Owner, the main interactions involve viewing and evaluating information collected by the system, including TOR requirements, TOR pricing, and other relevant TOR information.

## 2.3.Dependencies {#2.3.dependencies}

* Development, Deployment and Maintenance:   
  * The development and codebase was done with GIT version control and hosted on Github public repository.   
  * The deployment will be hosted on Google Cloud   
  * Maintenance will be done by the client after delivery of the system. Technical documentation will be provided to support future maintenance and system development.  
* Technology Stack:  
  * Next.js – used to develop the web-based frontend and user interface.  
  * Node.js – used to develop the backend services and system logic.  
  * MongoDB Atlas – used to store TOR contracts, Software House information, qualifications, and other system data.  
  * Google Vertex AI – used to provide AI-powered TOR evaluation, pricing evaluation, qualification evaluation, and TOR matching.  
* Infrastructure Hosting (Cloud)  
  * Docker \- the system will be packaged into containers compatible with docker systems.  
  * Google Cloud \- used to run docker and host the system.  
* 3rd Party:  
  * Google Vertex AI – used to provide AI capabilities for TOR evaluation, TOR pricing analysis, Software House qualification evaluation, and TOR matching.  
  * External TOR Hosting Websites – used as sources of publicly available TOR information.  
  * notification service (not specified yet) – used to notify Software Houses when suitable TOR matches are found.  
* Users will have a device such as a desktop or laptop connected to the internet and capable of running a modern web browser such as Google Chrome, Safari, Firefox, or Microsoft Edge.

### 

## 2.4.Out of Scope {#2.4.out-of-scope}

* The system will not submit bids or proposals on behalf of Software Houses.  
* The system will not directly create or modify TOR contracts on behalf of TOR Owners.  
* The system will not guarantee that an AI-generated match is suitable or that a Software House will win a contract.  
* There will be no direct communication or messaging system between Software Houses and TOR Owners.  
* The system will not handle payment or financial transactions between Software Houses and TOR Owners.  
* The system will not provide administration or management functionality unless specifically required by the client.  
* The system will not guarantee the accuracy of information published by external TOR hosting websites.  
* TOR contracts outside the defined geographical scope of Bangkok will not be included in the initial system scope.  
* The system will not expose private Software House qualifications or profile information to other Software Houses.

## 2.5.Assumptions {#2.5.assumptions}

* TOR contracts are publicly available online and can be accessed by the system's crawler.  
* External TOR hosting websites will remain accessible and their website structure will remain sufficiently stable for the crawler to operate.  
* Software Houses will provide accurate and up-to-date information about their company, skills, experience, and qualifications.  
* AI-generated evaluations and matching results are recommendations and should be verified by the Software House before pursuing a TOR.  
* Users will have a stable internet connection and a modern web browser.  
* Users are responsible for reviewing the original TOR source before making business decisions.  
* The system will store collected TOR information locally to reduce repeated requests to external TOR hosting websites.  
* AI-generated results may change if the underlying AI model or input information changes.  
* The system will attempt to identify the latest version of a TOR when updated information is available from the source.  
* The initial system will focus on TOR contracts located within Bangkok.  
* Software House profile and qualification information will remain private and will only be accessible to the respective Software House and authorized system components.

# 3.Stakeholders {#3.stakeholders}

## 3.1.Development {#3.1.development}

* **Project Owner (Prof. Sirisilp Kongsilp)**  
   The Project Owner is responsible for overseeing the development of the system and ensuring that the final product meets the project requirements and objectives. The Project Owner provides direction for the project, reviews the system's functionality, and evaluates whether the system successfully addresses the intended problems.  
* **Developer (Nattanan, Taam, Mohammed)**  
   The Developers are responsible for designing, developing, testing, and maintaining the system. Their responsibilities include implementing the TOR crawling system, database, user management, AI evaluation and matching features, TOR dashboard, and notification system. The Developers are also responsible for ensuring that the system meets the defined functional and non-functional requirements.

## 3.2.Users {#3.2.users}

* **Client (TOR Hosting Website, TOR Sources)**  
   The Client represents the external TOR Hosting Websites and TOR Sources from which the system collects TOR information. These sources provide publicly available TOR contracts that are used by the system. The system interacts with these sources primarily through its crawling functionality and should minimize unnecessary requests to avoid excessive traffic to their servers.  
* **TOR Owner (Contractor, TOR Publisher)**  
   The TOR Owner is the person, organization, or contractor responsible for creating or publishing a TOR. The TOR Owner provides the TOR requirements, qualifications, pricing information, and other relevant contract information through TOR Hosting Websites or other TOR Sources. The system allows their published TOR contracts to become more accessible to potential Software Houses and Freelancers.  
* **User (Software House, Freelancer)**  
   The User is the primary user of the system and represents Software Houses or Freelancers looking for suitable TOR contracts. Users can register and manage their information and qualifications, search and filter TOR contracts, review TOR requirements and pricing, and receive notifications when the system identifies a suitable TOR. Users are responsible for reviewing the TOR information and deciding whether to pursue the contract.

# 4\. User Stories {#4.-user-stories}

* US1. As a Software House, I want to be able to find TOR contracts in one place so that I can find work to do easily.  
* US2. As a Software House, I want to make sure that I Qualify for the TOR requirements so that I can offer the price confidently.  
* US3. As a TOR Owner, I want to make sure that the person who offers the work is qualified so that I can get the competent person to do the job I want.  
* US4. As the Project Owner, I want to understand and evaluate TOR information in the system, such as TOR pricing and TOR qualification requirements.  
* US5. As the Project Owner, I want all TORs in Bangkok to stay in one place so that all Software Houses and Freelancers can find the work more publicly, not only through an inner circle.  
* US6. As a Software House, I want to be able to upload my information so that the system can match me with suitable TORs.  
* US7. As a Software House, I want to be notified when there is a contract that is suitable for me so that I can receive the news as fast as possible.  
* US8. As a Software House, I want to be able to filter the TORs so that I can find the most suitable work for me.  
* US9. As a Software House, I want to be able to see the most updated version of a TOR so that I can make sure the version I read is the latest version.  
* US10. As a TOR Hosting Website, I don't want frequent requests on our servers so that I can keep the traffic down and keep costs low.  
* US11. As the Developer, I want to keep AI requests to a minimum so that I can keep the costs low.  
* US12. As a Software House, I don't want my data and qualifications to be shared with competing Software Houses so that I can keep my competition fair.

# 

# 5\. System Features {#5.-system-features}

## 5.1. TOR Website Crawlers and Dashboard {#5.1.-tor-website-crawlers-and-dashboard}

* FR1. The system can use AI to find online TOR contracts inside Bangkok.  
* FR2. The system can store TOR contracts.  
* FR3. The system can display TOR listings for Software Houses.  
* FR4. The system can group TOR contracts for Software Houses.  
* FR5. The system can filter TOR contracts for Software Houses.

## 5.2. Registration Feature {#5.2.-registration-feature}

* FR6. The system can handle registration for Software Houses.  
* FR7. The system can handle login for Software Houses that already have an account.  
* FR8. The system can handle logout for Software Houses.  
* FR9. The system can reset the password for Software Houses in case they forget their password.

## 5.3. Software House's Profile {#5.3.-software-house's-profile}

* FR10. The system can create Software House information and qualifications.  
* FR11. The system can edit Software House information and qualifications.  
* FR12. The system can delete Software House information and qualifications.

## 5.4. TOR Evaluation {#5.4.-tor-evaluation}

* FR13. The system can use Vertex AI to evaluate TOR qualification requirements.  
* FR14. The system can use Vertex AI to evaluate TOR pricing.  
* FR15. The system can use Vertex AI to evaluate Software House qualifications.

## 5.5. TOR Matching {#5.5.-tor-matching}

* FR16. The system can use Vertex AI to match suitable TORs and Software Houses.  
* FR17. The system can alert the Software House when a suitable match is found.

# 

# 6\. Non-Functional Requirements {#6.-non-functional-requirements}

* NFR1. The system should display the TOR listing within 3 seconds under normal operating conditions.  
* NFR2. The system should return search and filter results within 3 seconds under normal operating conditions.  
* NFR3. The system should minimize requests made to external TOR Hosting Websites.  
* NFR4. The system should minimize unnecessary requests to Vertex AI to reduce operating costs.  
* NFR5. The system should continue displaying previously stored TORs when an external TOR source is temporarily unavailable.  
* NFR6. The system should protect Software House information and qualifications from unauthorized access.  
* NFR7. Software House passwords should not be stored as plain text.  
* NFR8. The system should provide a clear and easy-to-understand interface for Software Houses.  
* NFR9. The system should support an increasing number of TOR contracts without significantly reducing performance.  
* NFR10. The system should support an increasing number of Software House accounts.  
* NFR11. The system should maintain the latest available version of each TOR.  
* NFR12. The system should clearly distinguish AI-generated evaluations from the original TOR information.  
* NFR13. The system should maintain logs of important system errors and operations to support maintenance.  
* NFR14. The system should allow the TOR crawler to be updated when the structure of an external TOR website changes.  
* NFR15. The system should prevent one Software House from accessing another Software House's private information and qualifications.  
* NFR16. The system should handle temporary unavailability of Vertex AI without preventing users from accessing stored TOR information.  
* NFR17. The system should not send Software House private information to Vertex AI when it is not required for the requested AI operation.  
* NFR18. The system should store or reuse previous AI evaluation results where appropriate to reduce repeated Vertex AI requests.

# 

# 7\. Use Case Modeling {#7.-use-case-modeling}

## 7.1. Use case model {#7.1.-use-case-model}

![][image1]

## 7.1.1 Use case Diagram Description

### **UC1: Crawl TOR contracts**

| Field | Details |
| :---- | :---- |
| **Use Case** | Crawl TOR contracts |
| **Actors** | TOR hosting website (secondary), System (automated) |
| **Type** | Primary and essential |
| **Description** | Initiated automatically on a scheduled interval, or manually by a Developer during setup. The system's crawler visits registered TOR hosting websites and extracts publicly available TOR contract details such as requirements, pricing, and deadlines, while limiting the frequency of requests made to each site. |
| **Includes** | None |
| **Extends** | None |
| **Cross Ref** | FR-1, US-01, US-05, US-10 |
| **Use-Cases** | None |

### **UC2: Store TOR contracts**

| Field | Details |
| :---- | :---- |
| **Use Case** | Store TOR contracts |
| **Actors** | System (automated) |
| **Type** | Primary and essential |
| **Description** | Initiated immediately after new or updated TOR information is crawled. The system saves the TOR contract data to the database and determines whether the record is a new listing or a newer version of an existing one. |
| **Includes** | None |
| **Extends** | None |
| **Cross Ref** | FR-2, US-01, US-04, US-05, US-09, US-10 |
| **Use-Cases** | None |

###  **UC3: View TOR listings**

| Field | Details |
| :---- | :---- |
| **Use Case** | View TOR listings |
| **Actors** | Software house, Project owner |
| **Type** | Primary and essential |
| **Description** | Initiated when a logged-in user navigates to the TOR dashboard. The system displays the currently stored TOR contracts, including requirements, pricing, and the latest available version of each listing. |
| **Includes** | None |
| **Extends** | None |
| **Cross Ref** | FR-3, US-01, US-04, US-05, US-08, US-09 |
| **Use-Cases** | None |

 

### 

### **UC4: Search & filter TORs**

| Field | Details |
| :---- | :---- |
| **Use Case** | Search & filter TORs |
| **Actors** | Software house |
| **Type** | Primary and essential |
| **Description** | Initiated when a Software house enters a keyword or selects filter criteria on the TOR dashboard. The system narrows the displayed TOR listings to match the specified search term, category, or requirement filters. |
| **Includes** | None |
| **Extends** | None |
| **Cross Ref** | FR-5, US-08 |
| **Use-Cases** | search and filter TOR |

### 

### **UC5: Group TOR listings**

| Field | Details |
| :---- | :---- |
| **Use Case** | Group TOR listings |
| **Actors** | Software house |
| **Type** | Primary and essential |
| **Description** | Initiated when a Software house chooses to organize the TOR dashboard by a shared attribute, such as category or source. The system re-arranges the displayed TOR contracts into the selected groups. |
| **Includes** | None |
| **Extends** | None |
| **Cross Ref** | FR-4, US-05, US-08 |
| **Use-Cases** | None |

### **UC6: Register account**

| Field | Details |
| :---- | :---- |
| **Use Case** | Register account |
| **Actors** | Software house |
| **Type** | Primary and essential |
| **Description** | Initiated when a new Software house chooses to create an account. The user submits company and contact details, and the system validates and stores the new account, hashing the password before it is saved, and grants access to the platform. |
| **Includes** | None |
| **Extends** | None |
| **Cross Ref** | FR-6 |
| **Use-Cases** | None |

###  

### **UC7: Log in**

| Field | Details |
| :---- | :---- |
| **Use Case** | Log in |
| **Actors** | Software house, Project owner |
| **Type** | Primary and essential |
| **Description** | Initiated when a user attempts an action that is restricted. The user is prompted to enter their registered username and password to verify their identity before the requested action is allowed to proceed. |
| **Includes** | None |
| **Extends** | Reset password (if the user has forgotten their credentials) |
| **Cross Ref** | FR-7 |
| **Use-Cases** | None |

 

### **UC8: Log out**

| Field | Details |
| :---- | :---- |
| **Use Case** | Log out |
| **Actors** | Software house, Project owner |
| **Type** | Primary and essential |
| **Description** | Initiated when a logged-in user chooses to end their session. The system invalidates the active session and returns the user to the public landing page. |
| **Includes** | None |
| **Extends** | None |
| **Cross Ref** | FR-8 |
| **Use-Cases** | None |

 

### **UC9: Reset password**

| Field | Details |
| :---- | :---- |
| **Use Case** | Reset password |
| **Actors** | Software house |
| **Type** | Primary and essential |
| **Description** | Initiated when a user is unable to log in and requests a password reset. The system verifies the user's identity, typically through a registered email address, and allows the user to set a new password. |
| **Includes** | None |
| **Extends** | None |
| **Cross Ref** | FR-9 |
| **Use-Cases** | None |

 

### 

### **UC10: Manage profile**

| Field | Details |
| :---- | :---- |
| **Use Case** | Manage profile |
| **Actors** | Software house |
| **Type** | Primary and essential |
| **Description** | Initiated when a logged-in Software house creates, edits, or deletes their company information and qualifications. The system validates the submitted information and updates the stored profile, which remains visible only to that Software house. |
| **Includes** | None |
| **Extends** | None |
| **Cross Ref** | FR-10, FR-11, FR-12, US-06, US-12 |
| **Use-Cases** | None |

###  

### **UC11: Evaluate TOR & pricing**

| Field | Details |
| :---- | :---- |
| **Use Case** | Evaluate TOR & pricing |
| **Actors** | System, Vertex AI (secondary) |
| **Type** | Primary and essential |
| **Description** | Initiated when a new or updated TOR contract requires evaluation. The system sends the relevant TOR requirement and pricing details to Vertex AI, which returns an assessment that is stored for use in later matching, reusing prior results where possible to limit AI usage. |
| **Includes** | None |
| **Extends** | None |
| **Cross Ref** | FR-13, FR-14, US-02, US-04, US-11 |
| **Use-Cases** | None |

 

### **UC12: Eval SW house quals**

| Field | Details |
| :---- | :---- |
| **Use Case** | Eval SW house quals |
| **Actors** | System, Vertex AI (secondary) |
| **Type** | Primary and essential |
| **Description** | Initiated when a Software house's profile is created or updated, or when a new matching cycle runs. The system sends only the qualification data required for the operation to Vertex AI, which returns a qualification assessment. |
| **Includes** | None |
| **Extends** | None |
| **Cross Ref** | FR-15, US-02, US-03, US-06, US-11 |
| **Use-Cases** | None |

###  **UC13: Match TORs to SW houses**

| Field | Details |
| :---- | :---- |
| **Use Case** | Match TORs to SW houses |
| **Actors** | System, Vertex AI (secondary) |
| **Type** | Primary and essential |
| **Description** | Initiated once a TOR and a Software house have both been evaluated. The system uses Vertex AI to compare the two evaluations, identify TORs that are a suitable match for the Software house's qualifications, and initiate a notification for each match found. |
| **Includes** | Evaluate TOR & pricing, Eval SW house quals, Notify matched SW house |
| **Extends** | None |
| **Cross Ref** | FR-16, US-03, US-06, US-07, US-11 |
| **Use-Cases** | None |

 

### **UC14: Notify matched SW house**

| Field | Details |
| :---- | :---- |
| **Use Case** | Notify matched SW house |
| **Actors** | Software house |
| **Type** | Primary and essential |
| **Description** | Initiated automatically once a suitable match is identified. The system sends a notification to the relevant Software house informing them that a newly matched TOR contract is available for review. |
| **Includes** | None |
| **Extends** | None |
| **Cross Ref** | FR-17, US-07 |
| **Use-Cases** | None |

### **UC15: Review TOR & AI data**

| Field | Details |
| :---- | :---- |
| **Use Case** | Review TOR & AI data |
| **Actors** | Project owner |
| **Type** | Primary and essential |
| **Description** | Initiated when the Project owner logs in to review system output. The Project owner views stored TOR information together with the AI-generated evaluations, which are clearly distinguished from the original TOR data, to assess whether the results meet expectations. |
| **Includes** | None |
| **Extends** | None |
| **Cross Ref** | FR-2, FR-3, FR-13, FR-14, US-04 |
| **Use-Cases** | None |

 

## 7.2. Dressed up use case — search and filter TOR {#7.2.-dressed-up-use-case-—-search-and-filter-tor}

**Primary Actor:** Software house

**Stakeholders and Interest:**

* The Software house wants to quickly narrow down TOR contracts to the ones that match their skills and interests without scanning every listing.  
  **Precondition:**  
* The Software house is registered and logged into the system.  
* At least one TOR contract has already been crawled and stored in the system.  
  **PostCondition:**  
* The system displays only the TOR contracts that match the entered search term and/or selected filters.  
  **Main Success scenario:**  
1. The user views the TOR dashboard \[Alt1: no TOR contracts have been stored yet\]  
2. The user enters a keyword and/or selects filter criteria (category, TOR source, budget range, posting date)  
3. The user presses the search/filter button \[Alt2: the user leaves all fields empty\]  
4. The system validates the entered keyword and/or filter selections \[Alt3: the system detects invalid filter input\]  
5. The system queries the stored TOR contracts using the given criteria  
6. The system displays the matching TOR listings \[Alt4: no TOR contracts match the criteria\]\[Alt5: the database is temporarily unavailable\]  
7. The user reviews the filtered list of TOR contracts  
   **Alternatives flow**  
1. **No TOR contracts have been stored yet**  
   1. The system shows an empty dashboard with a message that no TOR contracts are currently available  
   2. The user waits for the next crawl cycle or refreshes the dashboard  
   3. Go back to the Main Success scenario 1  
2. **The user leaves all fields empty**  
   1. The system keeps the search/filter button disabled until at least one keyword or filter is provided  
   2. The user enters a keyword or selects a filter  
   3. Go back to the Main Success scenario 3

3. **The system detects invalid filter input**  
   1. The system rejects the invalid value and keeps the last valid criteria applied  
   2. The user is notified which field is invalid  
   3. The user corrects the input  
   4. Go back to the Main Success scenario 4  
4. **No TOR contracts match the criteria**  
   1. The system displays a "no matching TOR contracts found" message  
   2. The system suggests the user broaden their search term or remove a filter  
   3. The user adjusts the search term or filters  
   4. Go back to the Main Success scenario 2  
5. **The database is temporarily unavailable**  
   1. The system displays the most recently stored results instead of live results, if available  
   2. The system notifies the user that results may not be fully up to date  
   3. Go back to the Main Success scenario 7

   **Exceptions:**

* If the search/ filter query takes noticeably long to process, show a loading indicator on the dashboard.  
* If an error happens after the system has already retried once, keep the user's entered keyword and filters, then notify the user.  
  **Special Requirements:**  
1. Search and filter results must return within 3 seconds under normal operating conditions.  
2. The system must minimize repeated requests to external TOR hosting websites while a user is searching or filtering.  
3. Filter results must be computed from already-stored TOR data, not by re-crawling on every search.  
     
 


## 7.3. Casual use case — Crawl TOR contracts {#7.3.-casual-use-case-—-crawl-tor-contracts}

**Main-Flow**

* The scheduler triggers a crawl cycle (or a Developer starts one manually).  
* The system visits each registered TOR hosting website.  
* The system extracts the TOR contract details (requirements, pricing, deadline, source).  
* The system checks whether the contract is new or a newer version of an existing one.  
* The system passes the contract to storage.  
  **Alternative Flows / Exceptions**  
* A1: Website Unreachable: If a TOR hosting website is temporarily unavailable, the system skips that source for this cycle and retries on the next scheduled crawl.  
* A2: Structure Changed: If the website's layout has changed and the crawler can't parse it, the system logs the error and notifies the Developer to update the crawler.  
* A3: Duplicate Contract: If the crawled contract already exists with no changes, the system discards it without creating a duplicate entry.

  ## 7.4. Casual use case — Login {#7.4.-casual-use-case-—-login}

  **Main-Flow**

* The user opens the login page.  
* The system displays the username and password fields.  
* The user enters their username and password.  
* The user presses "Log in."  
* The system verifies the credentials against the stored account.  
* The system grants access and redirects the user to the TOR dashboard.  
  **Alternative Flows / Exceptions**  
* A1: Invalid Credentials: If the username or password doesn't match, the system displays an "Incorrect username or password" message and lets the user try again.  
* A2: Forgot Password: If the user clicks "Forgot password," the system redirects them to the Reset password use case.  
* A3: Account Locked: If the account is locked after repeated failed attempts, the system displays a message and advises the user to try again later or reset their password.

## 7.5. Casual use case — Reset password {#7.5.-casual-use-case-—-reset-password}

**Main-Flow**

* The user clicks "Forgot password" on the login page.  
* The system prompts the user for their registered email address.  
* The user enters their email and submits.  
* The system sends a password reset link to the user's email.  
* The user opens the link and enters a new password.  
* The system updates the stored password and confirms the change.  
  **Alternative Flows / Exceptions**  
* A1: Unregistered Email: If the entered email isn't tied to any account, the system shows a generic "If this email exists, a reset link has been sent" message rather than confirming account existence.  
* A2: Expired Link: If the user opens the reset link after it has expired, the system displays an "Expired link" message and prompts them to request a new one.  
* A3: Weak Password: If the new password doesn't meet the security requirements, the system rejects it and asks the user to choose a stronger one.

## 7.6. Casual use case — Evaluate TOR {#7.6.-casual-use-case-—-evaluate-tor}

**Main-Flow**

* The system detects a new or updated TOR contract that needs evaluation.  
* The system sends the TOR's requirement and pricing details to Vertex AI.  
* Vertex AI analyzes the content and returns an evaluation.  
* The system stores the evaluation result alongside the TOR contract.  
* The system marks the TOR contract as evaluated and ready for matching.  
  **Alternative Flows / Exceptions**  
* A1: Vertex AI Unavailable: If Vertex AI is temporarily unreachable, the system queues the TOR contract for evaluation and retries later, without blocking access to already-stored TOR data.  
* A2: Evaluation Already Exists: If a valid, unchanged evaluation already exists for the TOR contract, the system reuses it instead of requesting a new one.  
* A3: Incomplete TOR Data: If the crawled TOR contract is missing key information, the system skips evaluation and flags the contract for review.

## 7.7. Casual use case — Notify match {#7.7.-casual-use-case-—-notify-match}

**Main-Flow**

* The system identifies a TOR contract that matches a Software house's evaluated qualifications.  
* The system generates a notification for the matched Software house.  
* The system sends the notification through the configured notification service.  
* The Software house receives the notification.  
* The Software house opens the notification and is taken to the matched TOR listing.  
  **Alternative Flows / Exceptions**  
* A1: Notification Service Unavailable: If sending fails, the system retries, and the match still appears in the Software house's dashboard regardless of notification status.  
* A2: Software House Unreachable: If the Software house's contact method is invalid, the system logs the failed notification and still displays the match in-app.  
* A3: Duplicate Match: If the same TOR-to-Software-house match was already notified, the system does not send a duplicate notification.

# 

# 8\. Requirements Traceability Matrix {#8.-requirements-traceability-matrix}

This section maps the User Stories (US) to the System Features (SF), Functional Requirements (FR), and Non-Functional Requirements (NFR). This mapping shows how each user's needs are translated into system functionality and quality requirements.

| User Story | System Feature | Functional Requirements | Non-Functional Requirements | Use Cases | Technology / Dependency |
| ----- | ----- | ----- | ----- | ----- | ----- |
| **US1** | SF1 – TOR Website Crawlers and Dashboard | FR1, FR2, FR3 | NFR1, NFR5, NFR9 | UC1, UC2, UC3 | Next.js, Node.js, MongoDB Atlas, TOR Sources |
| **US2** | SF4 – TOR Evaluation | FR13, FR15 | NFR4, NFR12 | UC11, UC12 | Vertex AI, Node.js |
| **US3** | SF5 – TOR Matching | FR15, FR16 | NFR12, NFR17 | UC12, UC13 | Vertex AI, Node.js |
| **US4** | SF1 – TOR Website Crawlers and Dashboard, SF4 – TOR Evaluation | FR2, FR3, FR13, FR14 | NFR11, NFR12 | UC2, UC3, UC11, UC15 | Next.js, Node.js, MongoDB Atlas, Vertex AI |
| **US5** | SF1 – TOR Website Crawlers and Dashboard | FR1, FR2, FR3, FR4 | NFR3, NFR5, NFR9 | UC1, UC2, UC3, UC5 | Node.js, MongoDB Atlas, TOR Sources |
| **US6** | SF3 – Software House's Profile, SF5 – TOR Matching | FR10, FR11, FR15, FR16 | NFR6, NFR15, NFR17 | UC10, UC12, UC13 | Next.js, Node.js, MongoDB Atlas, Vertex AI |
| **US7** | SF5 – TOR Matching | FR16, FR17 | NFR1, NFR12 | UC13, UC14 | Node.js, Vertex AI, Notification Service |
| **US8** | SF1 – TOR Website Crawlers and Dashboard | FR3, FR4, FR5 | NFR2, NFR8 | UC3, UC4, UC5 | Next.js, Node.js, MongoDB Atlas |
| **US9** | SF1 – TOR Website Crawlers and Dashboard | FR2, FR3 | NFR11, NFR12 | UC2, UC3 | Next.js, Node.js, MongoDB Atlas, TOR Sources |
| **US10** | SF1 – TOR Website Crawlers and Dashboard | FR1, FR2 | NFR3, NFR5 | UC1, UC2 | Node.js, MongoDB Atlas, TOR Sources |
| **US11** | SF4 – TOR Evaluation, SF5 – TOR Matching | FR13, FR14, FR15, FR16 | NFR4, NFR18 | UC11, UC12, UC13 | Vertex AI, Node.js |
| **US12** | SF3 – Software House's Profile | FR10, FR11, FR12 | NFR6, NFR7, NFR15, NFR17 | UC10 | Next.js, Node.js, MongoDB Atlas, Vertex AI |

