*** Stopped at Inferring Specification page 15 ***

# To read #

* Surveys of implementation issues in end-user programming have been discussed extensively in previous literature [Sutcliffe and Mehandjiev 2004; Kelleher and Pausch 2005; Lieberman et al. 2006; Wulf et al. 2006]. Use is somewhat out of scope for the primary paper but maintenance and sharing are discussed.

* Interview studies of people who wanted to develop web applications revealed that people are capable of envisioning simple interactive applications, but cannot imagine how to translate their requirements into working applications [Rosson et al. 2005]. 

* Some have proposed dealing with this lack of design experience by enforcing partic- ular design processes Ronen et al. [1989]. 

* Expressing specifications tend to be declarative in nature, allowing users to express what they want to happen, but not necessarily how [Erwig et al. 2005] [Abraham et al. 2005].


# Doubtful #

* Agile developers explicitly recognize that requirements will evolve and have tools and processes that plan for emergent requirements. In contrast,people engaging in end-user programming are unlikely to plan in this way.


# Seemingly missing from the survey paper #

* Spreadsheets mix the data and the code. You generally code with sample data.


# Terms and concepts #

* End-User Software Engineering (EUSE).
  * professionals are paid to ship and maintain software over time; end user programmers, in contrast, write programs to support some goal in their own domains of expertise. It's the goal that matters. System administrators and researcher scientists might be skilled programmers but they see it as a means to an end. 
  * Some may write programs to learn, that is out of scope for EUSE. Also out of scope is research about construction by end-users of software. EUSE is focused on engineering concerns like requirements, specifications, reuse, testing, and debugging.
  
* Program. A collection of specifications that may take variable inputs, and that can be executed (or interpreted) by a device with computational capabilities.

* Programming. The process of planning or writing a program.

* End user programming. Programming to achieve the result of a program primarily for personal, rather public use. Popularized by Nardi [1993].

* Professional programming. Has the goal of producing code for others to use. The distinction is intended to be continuous such that program for 5 users may have more in common with end-user programming than professional programming.

* End-user development. May overlap with end user programming but it may also encompass things like customization and configuration.

* Visual programming. May be professional or end-user.

* Domain specific language (DSL). May or may not be used in end-user programming.

* Scripting. Also orthagonal.

* Software engineering. One definition is the systematic and disciplined activities that address software quality issues. The key difference between professional software engineering and end-user software engineering is the amount attention given to software quality concerns. In EUSE, this priority is secondary to providing something of use to the user.

* Requirements. Refers to statements of how a program should behave in the world (as opposed to the internal behavior of a program, which is how it achieves these external concerns). People engaging in end-user programming rarely have an interest in explicitly stating their requirements. End users are programming for themselves so requirements elicitation techiniques are unnecessary. Changing requirements must only be negotiated with themselves. Automation must pay back for themselves, however, the more folks that will use it, the more it becomes like professional development. Sometimes debugging work can be considered requirements elicitation where the output values are checked, which confirms the understanding (or lack thereof) of original intent.

* Design specifications. Specify the internal behavior of a system, whereas the requirements are external (in the world). Design benefits are more long-term; end user programmers don't anticipate long-term use althought that's not always the outcome. Corporate spreadsheets double in size every 3 years [Whittaker 1999]. Some have proposed dealing with this lack of design experience by enforcing partic- ular design processes Ronen et al. [1989]. Primarily research has covered: web site, spreadsheet and privacy specification. An alternative to enforcing good behavior is to let end users work in the way they are used to working, but inject good design decisions into their existing practices. Frequently constraints are only learned when coding [Fischer and Giaccardi 2006]. Requirements and design in end-user programming are rarely separate activi- ties. Allow for parts of the design to be left in a rough and ambiguous state [Newman et al. 2003] (provisionality [Green et al. 2006]. Another approach to dealing with end users’ emergent designs is to constrain what can be designed to a particular domain. The WebSheets [Wolber et al. 2002] and Click[Rode et al. 2005a] environments for example. Yahoo Pipes (http://pipes.yahoo.com) and Apple's Automator also constrains in a higher level (visual) language. Expressing specifications tend to be declarative in nature, allowing users to express what they want to happen, but not necessarily how [Erwig et al. 2005] [Abraham et al. 2005]. 

* Professional and non-professional developers working together. Approaches that emphasize synchronous aspects view professional developers and end-user programmers as a team (e.g., Costabile et al. [2006] and Fischer and Giaccardi [2006]). On the other hand, in strictly asynchronous approaches, the professional developer provides tailoring mechanisms for end-user programmers, thereby building in flexibility for end-user programmers to adjust the software over time as new requirements emerge [Bandini and Simone 2006; Dittrich et al. 2006; Letondal 2006; Stevens et al. 2006; Won et al. 2006; Wulf et al. 2008]. As Pipek and Kahler [2006] point out, tailorability is a rich area, including not only issues of how to support low-level tailoring, but also numerous collaborative and social aspects.

* Specification for verification. Most other systems that support specification writing are used for later verification and checking, rather than generating programs. For example, Topes [Scaffidi et al. 2008] allowing users to define string-based data types that can be used to check the validity of data and operations in any programming language that stores information as strings. Other researchers have developed end-user specification languages for privacy and security. For example, Dougherty et al. [2006] describe a framework for expressing access-control policies in terms of domain concepts. These specifications are stated as “differences” rather than as absolutes. For example, rather than stating who gets privileges in a declarative form, the system supports statements such as “after this change, students should not gain any new privileges.” Cranor et al. [2006] describe Privacy Bird, a related approach, which includes a specification language for users to express their privacy preferences in terms of the personal information being made accessible.

* WYSIWYG. Some approaches for writing specifications take a direct manipulation, what you see is what you get (WYSIWYG) approach, moving the description of behavior and appearance to the user’s language, rather than a machine language. Dreamweaver.

Useful notes:

* According to statistics from the U.S. Bureau of Labor and Statistics, by 2012 in the United States there will be fewer than 3 million professional programmers, but more than 55 million people using spreadsheets and databases at work, many writing formulas and queries to support their job [Scaffidi et al. 2005]

* Studies of EUSE have been broad scoped: children, managers, researchers, bioinformatics professionals while early tools have been narrow scoped: spreadsheets and event-based com- puting paradigms and on perfective aspects of end-user software engineering, such as testing, verification and debugging. More recently however, this bias has been eliminated, with recent work focusing on a much broader set of domains and paradigms, including the web, mobile devices, personal information management, business processes, and programming in the home. Researchers have also extended their focus from perfective activities to design, including work on requirements, specifications, and reuse. Part of this shift is due to the advent of interactive web applications, as sharing code is becoming much more common.

SE Activity                 Professional SE    End-user SE
Requirements                explicit           implicit
Design and Specifications   explicit           implicit
Reuse                       planned            unplanned
Testing and Verification    cautious           overconfident
Debugging                   systematic         opportunistic

* EUSE must not alter the priorities. Providing support for these activities must be more passive and done with deference to their primary goal.

* The waterfall model [Ghezzi et al. 2002] is even less appropriate in end-user programming than it is in professional development.
 



