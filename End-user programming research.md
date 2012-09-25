# Agenda for talking to Jim #

* Something you said yesterday... So, rather than the hack-a-thon case study, what about a paper on defining a performance measurement system for Homeaway, JP Morgan, AutoDesk, McKesson, and Cisco. This is where I have come to the conclusion that teams with only dedicated members seem to perform at roughly 40% of than ones where more than 25% of the work is done by non-dedicated members. This is roughly 2.5x better. Here is a case study citation that might be a good template http://www.sciencedirect.com/science/article/pii/S0377221702009189

* The right questions for my PhD proposal

      better visualization/measurement -->
      	better insight -->
      		better decisions -->
      			better outcomes
      
      Lumenize is designed to allow users to create visualizations that provide better insight (for questions of their own devising)
      
      Research questions:
          How do you support people doing this given that they want to develop custom analysis?
            What are the needs you are addreassing?
            What is the basis for the tools? Design principles? example: need query specification, need visualization specification?
            Need evaluating. Provide them the tools and see how well they do and solves the problem
            Current practice drove them to ineffective things (control charts) but the TIP chart is better (sacred cow)
          Do the visualizations created by Lumenize lead to... better outcomes? [Jim says we don't need this. The outcome that they want is that they can create the visualization]
          Does Lumenize get you there faster/cheaper/better than alternatives?
          
Jim is out of town:
 - Oct 12-16
 - Oct 26-31
 - Nov 1-2
 - Nov 15-18
 - Thanksgiving Wed-Fri
 - Nov 29-30



# Notes for hack-a-thon case study #

The area of reuse is very different with a hack-a-thon. They start with code on GitHub and evolve it. In the case of Lumenize code, it's declarative which makes it less likely that they will fall into the problems of understanding outlined in the survey paper of end-user programmers looking at visual basic code. "use abstractions correctly, coordinating the use of multiple abstractions, and understanding why ab- stractions produced certain output [Ko et al. 2004]"

# Notes for Lumenize #

Section 3.3.4 about choosing the right abstractions is on target for Lumenize. I think it chooses the right abstractions. "For example, the designers of the Alice 3D programming system [Dann et al. 2006] con- sciously designed their APIs to provide abstractions that more closely matched peoples’ expectations about cameras, perspectives, and object movement." and "In other cases, choosing the right abstractions for a problem domain involves under- standing the data used in the domain, rather than the behavior. For example, Topes [Scaffidi et al. 2008] ..." and a warning "Specializing abstractions can result in a mismatch between the functionality of a reusable abstraction and the functionality needed by a programmer [Ye and Fischer 2005; Wiedenbeck 2005]."

Section 3.4.2 on testing - This is the closest I've found to saying that the data with the "program" is key. "The most notable of these approaches is the “What You See Is What You Test” (WYSIWYT) methodology for doing “white box” testing of spreadsheets [Rothermel et al. 1998, 2001; Burnett et al. 2002]"

Section 4.2 Pursuading people to use Lumenize

# Maybe to use as template for hack-a-thon case study #

* (good candidate for template except target message) HENDRY, D. G. AND GREEN, T. R. G. 1994. Creating, comprehending, and explaining spreadsheets: A cognitive interpretation of what discretionary users think of the spreadsheet model. Int. J. Hum.-Comput. Stud. 40, 6, 1033–1065. - Ten users were asked to explain how their spreadsheets worked. The focus of the paper seems to be to point out how the HCI literature's assumptions about EU programming are wrong. It also proposes three extreme positions of which spreadsheets occupies two.

* (can't download via scholar.google.com) NIESS, M., SADRI, P., AND LEE, K. 2007. Dynamic spreadsheets as learning technology tools: Developing teach- ers’ technology pedagogical content knowledge (TPCK). American Educational Research Association.

* (good candidate? explains WYSIWYT) LAWRANCE, J., ABRAHAM, R., BURNETT, M., AND ERWIG, M. 2006. Sharing reasoning about faults in spreadsheets: An empirical study. In Proceedings of the IEEE Symposium on Visual Languages and Human-Centric Computing. 35–42. "Although researchers have developed several ways to reason about the location of faults in spreadsheets, no single form of reasoning is without limitations. Multiple types of errors can appear in spreadsheets, and various fault localization techniques differ in the kinds of errors that they are effective in locating. In this paper, we report empirical results from an emerging system that attempts to improve fault localization for end-user programmers by sharing the results of the reasoning systems found in WYSIWYT and UCheck."

* (directly from google. easiest for me to mimic as it has a less academic style) Synergies from spreadsheet LP used with Theory of Constraints - a case study. VJ Mabin, J Gibson. Journal of Operational Research Society (1998) 49. 918-927

* (directly from google search not the survey paper) Using computerized business simulations and spreadsheet models in accounting education: a case study. N Marriott - Accounting Education, 2004 - Taylor & Francis

* HENDRY, D. G. AND GREEN, T. R. G. 1994. Creating, comprehending, and explaining spreadsheets: A cognitive
interpretation of what discretionary users think of the spreadsheet model. Int. J. Hum.-Comput. Stud. 40, 6, 1033–1065.

* Ronen et al. [1989] - ensuring the spreadsheets are reliable and evolvable via design process

* (rejected) POWELL, S. G. AND BAKER, K. R. 2004. The Art of Modeling with Spreadsheets: Management Science, Spreadsheet Engineering, and Modeling Craft. Wiley. This is a book and probably not a good template. 

# To read #

* Surveys of implementation issues in end-user programming have been discussed extensively in previous literature [Sutcliffe and Mehandjiev 2004; Kelleher and Pausch 2005; Lieberman et al. 2006; Wulf et al. 2006]. Use is somewhat out of scope for the primary paper but maintenance and sharing are discussed.

* Interview studies of people who wanted to develop web applications revealed that people are capable of envisioning simple interactive applications, but cannot imagine how to translate their requirements into working applications [Rosson et al. 2005]. 

* Some have proposed dealing with this lack of design experience by enforcing partic- ular design processes Ronen et al. [1989]. 

* Expressing specifications tend to be declarative in nature, allowing users to express what they want to happen, but not necessarily how [Erwig et al. 2005] [Abraham et al. 2005].


# Doubtful #

* Agile developers explicitly recognize that requirements will evolve and have tools and processes that plan for emergent requirements. In contrast,people engaging in end-user programming are unlikely to plan in this way.

* "Because end-user programmers’ designs tend to be emergent, like their require- ments, requirements and design in end-user programming are rarely separate activi- ties." I would argue that coding/programming is also not separate.

* How does GitHub change your conclusions in section 3.3.3 on creating reusable code? If the first thing they do is fork a repository and their fork is public, they know it's reusable.

The two below points are softened by your conclusion, "Finally, in all of this research, it is important to remember that the programs that end-user programmers create are just small parts of the much larger contexts of their lives at work and at home. Understanding how programming fits into end users’ ev- eryday lives is central to not only the design of the EUSE tools, but our understanding of why people program at all."

* "One approach to this problem is to train end-user programmers about software engineering and computer science principles rather than (or in addition to) trying to design tools around end users’ existing habits." I think the whole premise of hoping that they'll get better at SwE is off. The tools must provide all of the quality.

* Section 4.1 on risk-reward seems off. If they are going to program something so be it. Why convince them to use tools at all? Build it and they will either come... or not. You need to convince the folks with the data to include these tools as front-ends to their data sets.


# Seemingly missing from the survey paper #

* Spreadsheets mix the data and the code. You generally code with sample data.


# Terms and concepts #

* End-User Software Engineering (EUSE).
  * professionals are paid to ship and maintain software over time; end user programmers, in contrast, write programs to support some goal in their own domains of expertise. It's the goal that matters. System administrators and researcher scientists might be skilled programmers but they see it as a means to an end. 
  * Some may write programs to learn, that is out of scope for EUSE. Also out of scope is research about construction by end-users of software. EUSE is focused on engineering concerns like requirements, specifications, reuse, testing, and debugging.
  
* Program. A collection of specifications that may take variable inputs, and that can be executed (or interpreted) by a device with computational capabilities.

* Programming. The process of planning or writing a program.

* End user programming. Programming to achieve the result of a program primarily for personal, rather than public use. Popularized by Nardi [1993].

* Professional programming. Has the goal of producing code for others to use. The distinction is intended to be continuous such that program for 5 users may have more in common with end-user programming than professional programming.

* End-user development. May overlap with end user programming but it may also encompass things like customization and configuration.

* Visual programming. May be professional or end-user.

* Domain specific language (DSL). May or may not be used in end-user programming.

* Scripting. Also orthagonal.

* Software engineering. One definition is the systematic and disciplined activities that address software quality issues. The key difference between professional software engineering and end-user software engineering is the amount attention given to software quality concerns. In EUSE, this priority is secondary to providing something of use to the user.

* Requirements. Refers to statements of how a program should behave in the world (as opposed to the internal behavior of a program, which is how it achieves these external concerns). People engaging in end-user programming rarely have an interest in explicitly stating their requirements. End users are programming for themselves so requirements elicitation techiniques are unnecessary. Changing requirements must only be negotiated with themselves. Automation must pay back for themselves, however, the more folks that will use it, the more it becomes like professional development. Sometimes debugging work can be considered requirements elicitation where the output values are checked, which confirms the understanding (or lack thereof) of original intent.

* Design specifications. Specify the internal behavior of a system, whereas the requirements are external (in the world). Design benefits are more long-term; end user programmers don't anticipate long-term use althought sometimes they are reused quite a bit. Corporate spreadsheets double in size every 3 years [Whittaker 1999]. Some have proposed dealing with this lack of design experience by enforcing partic- ular design processes Ronen et al. [1989]. Primarily research has covered: web site, spreadsheet and privacy specification. An alternative to enforcing good behavior is to let end users work in the way they are used to working, but inject good design decisions into their existing practices. Frequently constraints are only learned when coding [Fischer and Giaccardi 2006]. Requirements and design in end-user programming are rarely separate activi- ties. Allow for parts of the design to be left in a rough and ambiguous state [Newman et al. 2003] (provisionality [Green et al. 2006]. Another approach to dealing with end users’ emergent designs is to constrain what can be designed to a particular domain. The WebSheets [Wolber et al. 2002] and Click[Rode et al. 2005a] environments for example. Yahoo Pipes (http://pipes.yahoo.com) and Apple's Automator also constrains in a higher level (visual) language. Expressing specifications tend to be declarative in nature, allowing users to express what they want to happen, but not necessarily how [Erwig et al. 2005] [Abraham et al. 2005]. 

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

* Because end-user programmers’ designs tend to be emergent, like their require- ments, requirements and design in end-user programming are rarely separate activi- ties.


All references
REFERENCES
ABRAHAM, R. AND ERWIG, M. 2004. Header and unit inference for spreadsheets through spatial analy- ses. In Proceedings of the IEEE Symposium on Visual Languages and Human-Centric Computing. 165–172.
ABRAHAM, R. AND ERWIG, M. 2006a. Inferring templates from spreadsheets. In Proceedings of the International Conference on Software Engineering. 182–191.
ABRAHAM, R. AND ERWIG, M. 2006b. AutoTest: A tool for automatic test case generation in spreadsheets. In Proceedings of the Symposium on Visual Languages and Human-Centric Computing. 43–50.
ABRAHAM, R. AND ERWIG, M. 2006c. Type inference for spreadsheets. In Proceedings of the Symposium on ACM International Symposium on Principles and Practice of Declarative Programming. 73–84.
ABRAHAM, R. AND ERWIG, M. 2007a. GoalDebug: A spreadsheet debugger for end users. In Proceedings of the International Conference on Software Engineering. 251–260.
ABRAHAM, R. AND ERWIG, M. 2007b. UCheck: A spreadsheet unit checker for end users. J. Visual Lang. Comput. 18, 1, 71–95.
ABRAHAM, R., ERWIG, M., AND ANDREW, S. 2007. A type system based on end-user vocabulary. In Proceedings of the IEEE Symposium on Visual Languages and Human-Centric Computing. 215–222.
ABRAHAM, R., ERWIG, M., KOLLMANSBERGER, S., AND SEIFERT, E. 2005. Visual specifications of correct spread- sheets. In Proceedings of the IEEE International Symposium on Visual Languages and Human-Centric Computing. 189–196.
AHMAD, Y., ANTONIU, T., GOLDWATER, S., AND KRISHNAMURTHI, S. 2003. A type system for statically detecting spreadsheet errors. In Proceedings of the International Conference on Automated Software Engineering. 174–183.
ANTONIU, T., STECKLER, P. A., KRISHNAMURTHI, S., NEUWIRTH, E., AND FELLEISEN, M. 2004. Validating the unit correctness of spreadsheet programs. In Proceedings of the International Conference on Software Engi- neering. 439–448.
AYALEW, Y. AND MITTERMEIR, R. 2003. Spreadsheet debugging. European Spreadsheet Risks Interest Group. BAKER, S. J. 2007. Modeling and understanding students’ off-task behavior in intelligent tutoring systems.
In Proceedings of the ACM Conference on Human Factors in Computer Systems. 1059–1068. BALABAN, M., BARZILAY, E., AND ELHADAD, M. 2002. Abstraction as a means for end user computing in creative
applications. IEEE Trans. Syst. 32, 6, 640–653. BALLINGER, D., BIDDLE, R., AND NOBLE, J. 2003. Spreadsheet visualisation to improve end-user understanding.
In Proceedings of the Asia-Pacific Symposium on Information Visualisation. 24, 99–109. BANDINI, S. AND SIMONE, C. 2006. EUD as integration of components off-the-shelf. In Proceedings of the End-
User Development. Springer, 183–205. BANDURA, A. 1977. Self-efficacy: Toward a unifying theory of behavioral change. Psych. Rev. 8, 2, 191–215. BARRETT, R., KANDOGAN, E., MAGLIO, P. P., HABER, E. M., TAKAYAMA, L. A., AND PRABAKER, M. 2004. Field studies
of computer system administrators: analysis of system management tools and practices. In Proceedings
of the ACM Conference on Computer Supported Cooperative Work. 388–395. BECK, K. 2007. Implementation Patterns. Addison-Wesley. BECKWITH, L. 2007. Gender HCI issues in end-user programming, Ph.D. dissertation. Oregon State University. BECKWITH, L. AND BURNETT, M. 2004. Gender: An important factor in problem-solving software? In Proceed-
ings of the IEEE Symposium on Visual Languages and Human-Centric Computing Languages and Environments. 107–114.
BECKWITH, L., BURNETT, M., WIEDENBECK, S., COOK, C., SORTE, S., AND HASTINGS, M. 2005a. Effectiveness of end-user debugging features: Are there gender issues? In Proceedings of the ACM Conference on Human Factors in Computing Systems. 869–878.
BECKWITH, L., INMAN, D., RECTOR, K., AND BURNETT, M. 2007. On to the real world: Gender and self-efficacy in Excel. In Proceedings of the IEEE Symposium on Visual Languages and Human-Centric Computing. 119–126.
BECKWITH, L., KISSINGER, C., BURNETT, M., WIEDENBECK, S., LAWRANCE, J., BLACKWELL, A., AND COOK, C. 2006. Tinkering and gender in end-user programmers’ debugging. In Proceedings of the ACM Conference on Human Factors in Computing Systems. 231–240.
BECKWITH, L., SORTE, S., BURNETT, M., WIEDENBECK, S., CHINTAKOVID, T., AND COOK, C. 2005b. Designing features for both genders in end-user programming environments. In Proceedings of the IEEE Symposium on Visual Languages and Human-Centric Computing. 153–160.
BEIZER, B. 1990. Software Testing Techniques. Van Nostrand Reinhold, New York, NY. BELLETTINI, C., DAMIANI, E., AND FUGINI, M. 1999. User opinions and rewards in reuse-based development
system. In Proceedings of the Symposium on Software Reusability. 151–158. BELLON, S., KOSCHKE, R., ANTONIOL, G., KRINKE, J., AND MERLO, E. 2007. Comparison and evaluation of clone
detection tools. IEEE Trans. Soft. Eng. 33, 9, 577–591. BERTI, S., PATERNO`, F., AND SANTORO, C. 2006. Natural development of nomadic interfaces based on conceptual
descriptions. In End User Development, 143–160. BEYER, H. AND HOLTZBLATT, K. 1998. Contextual Design: Defining Customer-Centered Systems. Morgan
Kaufmann. BEYER, S., RYNES, K., PERRAULT, J., HAY, K., AND HALLER, S. 2003. Gender differences in computer science
students. In Proceedings of the Special Interest Group on Computer Science Education. 49–53. BIGGERSTAFF, T. AND RICHTER, C. 1989. Reusability framework, assessment, and directions. In Software
Reusability: Vol. 1, Concepts and Models. 1–17. BLACKWELL, A. F. 2002. First steps in programming: A rationale for attention investment models. In Proceed-
ings of the IEEE Symposia on Human-Centric Computing Languages and Environments. 2–10. BLACKWELL, A. F. 2004. End user developers at home. Comm. ACM 47, 9, 65–66. BLACKWELL, A. F. 2006. Gender in domestic programming: From bricolage to se ́ances d’essayage. In Proceed-
ings of the CHI Workshop on End User Software Engineering. BLACKWELL, A. AND BURNETT, M. 2002. Applying attention investment to end-user programming. In Proceedings
of the IEEE Symposia on Human-Centric Computing Languages and Environments. 1–4. BLACKWELL, A. AND GREEN, T. R. G. 1999. Investment of attention as an analytic approach to cognitive dimensions. In Proceedings of the 11th Workshop of the Psychology of Programming Interest Group.
24–35. BLACKWELL, A. AND HAGUE, R. 2001. AutoHAN: An architecture for programming the home. In Pro-
ceedings of the IEEE Symposia on Human Centric Computing Languages and Environments.
150–157. BLACKWELL, A. F., RODE, J. A., AND TOYE, E. F. 2009. How do we program the home? Gender, attention
investment, and the psychology of programming at home. Int. J. Human Comput. Stud. 67, 324–341. BOEHM, B. W. 1988. A spiral model of software development and enhancement. IEEE Comput. 21, 5,
61–72. BOGART, C., BURNETT, M. M., CYPHER, A., AND SCAFFIDI, C. 2008. End-user programming in the wild: A field study
of CoScripter scripts. In Proceedings of the IEEE Symposium on Visual Languages and Human-Centric
Computing, To appear. BOLIN, M., WEBBER, M., RHA, P., WILSON, T., AND MILLER, R. 2005. Automation and customization of ren-
dered web pages. In Proceedings of the ACM Symposium on User Interface Software and Technology.
163–172. BRANDT, J., GUO, P., LEWENSTEIN, J., AND KLEMMER, S. R. 2008. Opportunistic programming: How rapid ideation
and prototyping occur in practice. In Proceedings of the Workshop on End-User Software Engineering
(WEUSE). BROOKS, R. 1977. Towards a theory of the cognitive processes in computer programming, Int. J. Human-
Comput. Stud. 51, 197–211. BROWN, D., BURNETT, M., ROTHERMEL, G., FUJITA, H., AND NEGORO, F. 2003. Generalizing WYSIWYT visual test-
ing to screen transition languages. In Proceedings of the IEEE Symposium on Human-Centric Computing
Languages and Environments. 203–210. BURNETT, M. 2001. Software engineering for visual programming languages. In Handbook of Software Engi-
neering and Knowledge Engineering, vol. 2, World Scientific Publishing Company.
BURNETT, M., ATWOOD, J., DJANG, R. W., GOTTFRIED, H., REICHWEIN J., AND YANG S. 2001a. Forms/3: A first-order visual language to explore the boundaries of the spreadsheet paradigm. J. Funct. Prog. 11, 2, (Mar.) 155–206.
BURNETT, M., CHEKKA, S. K., AND PANDEY, R. 2001b. FAR: An end-user language to support cottage e-services. In Proceedings of the IEEE Symposium on Human-Centric Computing. 195–202.
BURNETT, M., COOK, C., PENDSE, O., ROTHERMEL, G., SUMMET, J., AND WALLACE C. 2003. End-user software engineering with assertions in the spreadsheet paradigm. In Proceedings of the International Conference on Software Engineering. 93–103.
BURNETT, M., COOK, C., AND ROTHERMEL, G. 2004. End-user software engineering. Comm. ACM, 53–58. BURNETT, M., SHERETOV, A., REN, B., AND ROTHERMEL, G. 2002. Testing homogeneous spreadsheet grids with
the ’What You See Is What You Test’ methodology. IEEE Trans. Softw. Eng. 576–594. BUSCH, T. 1995. Gender differences in self-efficacy and attitudes toward computers. J. Educat. Comput. Res.
12, 147–158. BUXTON, B. 2007. Sketching User Experiences: Getting the Design Right and the Right Design. Morgan-
Kaufmann. CARMIEN, S. P. AND FISCHER, G. 2008. Design, adoption, and assessment of a socio-technical environment
supporting independence for persons with cognitive disabilities. In Proceedings of the ACM Conference
on Human Factors in Computing Systems. 597–606. CARVER, J., KENDALL, R., SQUIRES, S., AND POST, D. 2007. Software engineering environments for scientific and
engineering software: a series of case studies. In Proceedings of the International Conference on Software
Engineering. 550–559. CHAMBERS, C. AND ERWIG, M. 2009. Automatic detection of dimension errors in spreadsheets. J. Visu. Lang.
Comput. 20, 2009. CHINTAKOVID, T., WIEDENBECK, S., BURNETT, M., AND GRIGOREANU, V. 2006. Pair collaboration in end-user de-
bugging. In Proceedings of the IEEE Symposium on Visual Languages and Human-Centric Computing.
3–10. CLERMONT, M. 2003. Analyzing large spreadsheet programs. In Proceedings of the Working Conference on
Reverse Engineering. 306–315. CLERMONT, M. AND MITTERMEIR, R. 2003. Auditing large spreadsheet programs. In Proceedings of the Interna-
tional Conference on Information Systems Implementation and Modeling. 87–97. CLERMONT, M., HANIN, C., AND MITTERMEIR, R. 2002. A spreadsheet auditing tool evaluated in an industrial
context. Spreadsheet Risks, Audit, Develop. Methods 3, 35–46. COBLENZ, M. J., KO, A. J., AND MYERS, B. A. 2005. Using objects of measurement to detect spreadsheet errors.
In Proceedings of the IEEE Symposium on Visual Languages and Human-Centric Computing. 23–26,
314–316. COPLIEN, J. O. AND HARRISON, N. B. 2004. Organizational Patterns of Agile Software Development. Prentice-
Hall, Inc., Upper Saddle River, NJ. COOPER, A. AND REIMANN, R. 2003. About Face 2.0: The Essentials of Interaction Design. Wiley. COSTABILE, M. F., FOGLI, D., MUSSIO, P., AND PICCINNO, A. 2006. End-user development: The software shaping
workshop approach. In End-User Development, Springer, 183–205. COSTABILE, M. F., MUSSIO, P., PROVENZA, L. P., AND PICCINNO, A. 2009. Supporting end users to be co-designers
of their tools. In Proceedings of the 2nd International Symposium on End-User Development. Lecture
Notes in Computer Science, vol. 5435, Springer-Verlag, Berlin, 70–85. COX, P. T., GILES, F. R., AND PIETRZYKOWSKI, T. 1989. Prograph: A step towards liberating programming from
textual conditioning. In Proceedings of the IEEE Workshop on Visual Languages. 150–156. CRANOR, L. F., GUDURU, P., AND ARJULA, M. 2006. User interfaces for privacy agents. ACM Trans. Comput.-Hum.
Interact. 13, 2, 135–178. DANN, W., COOPER, S., AND PAUSCH, R. 2006. Learning to Program with Alice. Prentice-Hall. DAVIS, J. S. 1996. Tools for spreadsheet auditing. Int. J. Hum.-Comput. Stud. 45, 429–442. DEHAAN, J. 2006. End-user programming and flash. In Proceedings of the 2nd Workshop on End-User Software
Engineering in conjunction with the ACM Conference on Human Factors in Computing. DELINE, R. 1999. A catalog of techniques for resolving packaging mismatch. In Proceedings of the Symposium
on Software Reusability. 44–53. DITTRICH, Y., LINDEBERG, O., AND LUNDBERG, L. 2006. End-user development as adaptive maintenance. In
End-User Development, Springer, 295–313. DOUGHERTY, D. J., FISLER, K., AND KRISHNAMURTHI, S. 2006. Specifying and reasoning about dynamic
access-control policies. In Proceedings of the International Joint Conference on Automated Reasoning. 632–646.
DOUGLAS, S., DOERRY, E., AND NOVICK, D. 1990. Quick: A user-interface design kit for non-programmers. In Proceedings of the ACM Symposium on User Interface Software and Technology. 47–56.
EAGAN, J. R. AND STASKO, J. T. 2008. The buzz: Supporting user tailorability in awareness applications. In Proceedings of the ACM Conference on Human Factors in Computing Systems. 1729–1738.
ELBAUM, S., ROTHERMEL, G., KARRE, S., AND FISHER II, M. 2005. Leveraging user session data to support web application testing. IEEE Trans. Softw. Eng. 31 3, 187–202.
ERWIG, M. AND BURNETT, M. 2002. Adding apples and oranges. In Proceedings of the 4th International Sym- posium on Practical Aspects of Declarative Languages. Lecture Notes in Computer Science, vol. 2257. Springer, 173–191.
ERWIG, M., ABRAHAM, R., COOPERSTEIN, I., AND KOLLMANSBERGER, S. 2005. Automatic generation and mainte- nance of correct spreadsheets. In Proceedings of the International Conference on Software Engineering. 136–145.
ERWIG, M., ABRAHAM, R., KOLLMANSBERGER, S., AND COOPERSTEIN, I. 2006. Gencel—A program generator for correct spreadsheets. J. Funct. Prog. 16, 3, 293–325.
EZRAN, M., MORISIO, M., AND TULLY, C. 2002. Practical Software Reuse, Springer. FISCHER, G. AND GIACCARDI, E. 2006. Meta-design: A framework for the future of end user development. In End
User Development Empowering People to Flexibly Employ Advanced Information and Communication
Technology, Kluwer Academic Publishers, Dordrecht, The Netherlands, 427–457. FISCHER, G. AND GIRGENSOHN, A. 1990. End user modifiability in design environments. In Proceedings of the
ACM Conference on Human Factors in Computing Systems. 183–192. FISHER II, M., CAO, M., ROTHERMEL, G., BROWN, D., COOK, C. R., AND BURNETT M. M. 2006b. Integrating automated
test generation into the WYSIWYT spreadsheet testing methodology. ACM Trans. Soft. Eng. Method.
15, 2, 150–194. FISHER II, M., CAO, M., ROTHERMEL, G., COOK, C. R., AND BURNETT, M. M. 2002a. Automated test case gen-
eration for spreadsheets. In Proceedings of the International Conference on Software Engineering.
141–151. FISHER II, M., JIN, D., ROTHERMEL, G., AND BURNETT, M. 2002b. Test reuse in the spreadsheet paradigm. In
Proceedings of the IEEE International Symposium on Software Reliability Engineering. 257–264. FISHER II, M., ROTHERMEL, G., CREELAN, T., AND BURNETT, M. 2006a. Scaling a dataflow testing methodology to the multiparadigm world of commercial spreadsheets. In Proceedings of the IEEE International
Symposium on Software Reliability Engineering. 13–22. FRANKL, P. G. AND WEISS, S. N. 1993. An experimental comparison of the effectiveness of branch testing and
data flow testing. IEEE Trans. Softw. Eng. 19, 8, 774–787. GARLAN, D., ALLEN, R., AND OCKERBLOOM, J. 1995. Architectural mismatch or why it’s hard to build sys-
tems out of existing parts. In Proceedings of the International Conference on Software Engineering,
179–185. GHEZZI, C., JAZAYERI, M., AND MANDRIOLI, D. 2002. Fundamentals of Software Engineering. Prentice-Hall. GORB, P. AND DUMAS, A. 1987. Silent design. Des. Stud. 8, 150–156. GREEN, T. R. G., BLANDFORD, A., CHURCH, L. ROAST, C., AND CLARKE, S. 2006. Cognitive Dimensions: achieve-
ments, new directions, and open questions. J. Vis. Lang. Comput. 17, 4, 328–365. GRIGOREANU, V., BECKWITH, L., FERN, X., YANG, S., KOMIREDDY, C., NARAYANAN, V., COOK, C., AND BURNETT, M. M. 2006. Gender differences in end-user debugging, revisited: What the miners found. In Proceedings of the
IEEE Symposium on Visual Languages and Human-Centric Computing. 19–26. GRIGOREANU, V., CAO, J., KULESZA, T., BOGART, C., RECTOR, K., BURNETT, M., AND WIEDENBECK, S. 2008. Can feature design reduce the gender gap in end-user software development environments? In Proceedings of the
IEEE Symposium on Visual Languages and Human-Centric Computing. GROSS, M. D. AND DO, E. Y. 1996. Ambiguous intentions: A paper-like interface for creative design. In Pro-
ceedings of the ACM Symposium on User Interface Software and Technology. 183–192. GUGERTY, L. AND OLSON, G. M. 1986. Comprehension differences in debugging by skilled and novice program-
mers. In Empirical Studies of Programmers. Ablex Publishing Corporation, 13–27. GULLEY, N. 2006. Improving the quality of contributed software on the MATLAB file exchange. In Proceedings of the 2nd Workshop on End-User Software Engineering, in conjunction with the ACM Conference on
Human Factors in Computing. HENDERSON, A., AND KYNG, M. 1991. There’s no place like home: Continuing design in use. In Design at Work.
Lawrence Erlbaum Associates, 219–240. 
HENDRY, D. G. AND GREEN, T. R. G. 1994. Creating, comprehending, and explaining spreadsheets: A cognitive
interpretation of what discretionary users think of the spreadsheet model. Int. J. Hum.-Comput. Stud. 40, 6, 1033–1065.

HUTCHINS, M., FOSTER, H., GORADIA, T., AND OSTRAND, T. 1994. Experiments on the effectiveness of dataflow- and controlflow-based test adequacy criteria. In Proceedings of the International Conference on Software Engineering. 191–200.
IGARASHI, T., MACKINLAY, J. D., CHANG, B.-W., AND ZELLWEGER, P. T. 1998. Fluid visualization of spreadsheet structures. In Proceedings of the IEEE Symposium on Visual Languages. 118–125.
IOANNIDOU, A., RADER, C., REPENNING, A., LEWIS, C., AND CHERRY, G. 2003. Making constructionism work in the classroom. Int. J. Comput. Math. Learn. 8, 1, 63–108.
JONES, M. G., BRADER-ARAJE, L., CARBONI, L. W., CARTER, G., RUA, M. J., BANILOWER, E., AND HATCH, H. 2000. Tool time: Gender and students’ use of tools, control, and authority. J. Res. Sci. Teach. 37, 8, 760–783.
KAFAI, Y. 1996. Gender differences in children’s constructions of video games. In Interacting with Video, Greenwood Publishing Group, 39–66.
KAHLER, H. 2001. More Than WORDs - Collaborative tailoring of a word processor. J. Uni. Comput. Sci. 7, 9, 826–847.
KARAM, M. AND SMEDLEY, T. 2002. A testing methodology for a dataflow based visual programming language. In Proceedings of the IEEE Symposia on Human-Centric Computing. 86–89.
KATZ, I.R. AND ANDERSON, J. R. 1988. Debugging: An analysis of bug-location strategies, Human Comput. Interact. 3, 351–399.
KELLEHER, C. AND PAUSCH, R. 2005. Lowering the barriers to programming: A taxonomy of programming environments and languages for novice programmers. ACM Comput. Surv. 37, 2, 83–137.
KELLEHER, C. AND PAUSCH, R. 2006. Lessons learned from designing a programming system to support middle school girls creating animated stories. In Proceedings of the IEEE Symposium on Visual Languages and Human-Centric Computing. 165–172.
KELLEHER, C., PAUSCH, R., AND KIESLER, S. 2007. Storytelling Alice motivates middle school girls to learn computer programming. In Proceedings of the ACM Conference on Human Factors in Computing Systems. 1455–1464.
KISSINGER, C., BURNETT, M., STUMPF, S., SUBRAHMANIYAN, N., BECKWITH, L., YANG, S., AND ROSSON, M. B. 2006. Supporting end-user debugging: What do users want to know? In Advanced Visual Interfaces, 135–142.
KO, A. J. 2008. Asking and answering questions about the causes of software behaviors, Ph.D. dissertation, Human-Computer Interaction Institute Technical Report CMU-CS-08-122.
KO, A. J. DELINE, R., AND VENOLIA, G. 2007. Information needs in collocated software development teams. In Proceedings of the International Conference on Software Engineering. 344–353.
KO, A. J. AND MYERS, B. A. 2003. Development and evaluation of a model of programming errors. In Proceedings of the IEEE Symposium Human-Centric Computing Languages and Environments.
KO, A. J. AND MYERS, B. A. 2004. Designing the Whyline: A debugging interface for asking questions about program failures. In Proceedings of the ACM Conference on Human Factors in Computing Systems. 151–158.
KO, A. J. AND MYERS, B. A. 2005. A framework and methodology for studying the causes of software errors in programming systems. J. Vis. Lang. and Comput. 16, 1–2, 41–84.
Ko, A. J. and Myers, B. A. 2006. Barista: An implementation framework for enabling new tools, interaction techniques and views for code editors. In Proceedings of the ACM Conference on Human Factors in Computing Systems. 387–396.
KO, A. J. AND MYERS, B. A. 2008. Debugging reinvented: Asking and answering why and why not questions about program behavior. In Proceedings of the International Conference on Software Engineering (ICSE). 301–310.
KO, A. J., MYERS, B. A., AND AUNG, H. H. 2004. Six learning barriers in end-user programming systems. In Proceedings of the IEEE Symposium on Visual Languages and Human-Centric Computing. 199–206.
KRISHNA, V., COOK, C., KELLER, D., CANTRELL, J., WALLACE, C., BURNETT, M., AND ROTHERMEL, G. 2001. Incorpo- rating incremental validation and impact analysis into spreadsheet maintenance: An empirical study. In Proceedings of the IEEE International Conference on Software Maintenance. 72–81.
KRISHNAMURTHI, S., FINDLER, R. B., GRAUNKE, P., AND FELLEISEN, M. 2006. Modeling web interactions and errors. In Interactive Computation: The New Paradigm, Springer Lecture Notes in Computer Science. Springer- Verlag.
LAKSHMINARAYANAN, V., LIU, W., CHEN, C. L., EASTERBROOK, S. M., AND PERRY D. E. 2006. Software architects in practice: Handling requirements. In Proceedings of the 16th International Conference of the IBM Centers for Advanced Studies. 16–19.
LATOZA, T., VENOLIA, G., AND DELINE, R. 2006. Maintaining mental models: A study of developer work habits. In Proceedings of the International Conference on Software Engineering. 492–501.
LAWRANCE, J., CLARKE, S., BURNETT, M., AND ROTHERMEL, G. 2005. How well do professional developers test with code coverage visualizations? An empirical study. In Proceedings of the IEEE Symposium on Visual Languages and Human-Centric Computing. 53–60.
LAWRANCE, J., ABRAHAM, R., BURNETT, M., AND ERWIG, M. 2006. Sharing reasoning about faults in spreadsheets: An empirical study. In Proceedings of the IEEE Symposium on Visual Languages and Human-Centric Computing. 35–42.
LESHED, G., HABER, E. M., MATTHEWS, T., AND LAU, T. 2008. CoScripter: Automating & sharing how-to knowledge in the enterprise. In Proceedings of the ACM Conference on Human Factors in Computing Systems. 1719–1728.
LETONDAL, C. 2006. Participatory programming: Developing programmable bioinformatics tools for end users. In End-User Development, Springer, 207–242.
LEVENTHAL, L. M., TEASLEY, B. E., AND ROHLMAN, D. S. 1994. Analyses of factors related to positive test bias in software testing. Int. J. Hum.-Comput. Stud. 41, 717–749.
LIEBERMAN, H. AND FRY, C. 1995. Bridging the gulf between code and behavior in programming. In Proceedings of the ACM Conference on Human Factors in Computing. 480–486.
LIEBERMAN, H. AND FRY, C. 1997. ZStep 95: A reversible, animated, source code stepper. In Software Visual- ization: Programming as a Multimedia Experience, MIT Press, Cambridge, MA.
LIEBERMAN, H. (ed.) 2000. Your Wish Is My Command: Giving Users the Power to Instruct their Software. Morgan-Kaufmann.
LIEBERMAN, H., PATERNO, F., AND WULF, V. Eds. 2006. End-User Development. Kluwer/ Springer. LIM, B., DEY, A., AND AVRAHAMI, D. 2009. Why and why not explanations improve the intelligibility of context- aware intelligent systems. In Proceedings of the ACM Conference on Human Factors in Computing
Systems. 2119–2128. LIN, J. AND LANDAY, J. A. 2008. Employing patterns and layers for early-stage design and prototyping of cross-
device user interfaces. In Proceedings of the ACM Conference on Human Factors in Computing Systems.
1313–1322. LINGAM, S. AND ELBAUM, S. 2007. Supporting end-users in the creation of dependable web clips. In Proceedings
of the International Conference on World Wide Web. 953–962.
LITTLE, G., LAU, T. A., CYPHER, A., LIN, J., HABER, E. M., AND KANDOGAN, E. 2007. Koala: Capture, share, automate, personalize business processes on the web. In Proceedings of the ACM Conference on Human Factors in Computing Systems. 943–946.
LITTLE, G. AND MILLER, R. C. 2006. Translating keyword commands into executable code. In Proceedings of the ACM Symposium on User Interface Software and Technology. 135–144.
LITTMAN, D. C., PINTO, J., LETOVSKY, S., AND SOLOWAY, E. 1986. Mental models and software maintenance. In Proceedings of the 1st Workshop on Empirical Studies of Programmers. 80–98.
LIU, H. AND LIEBERMAN, H. 2005. Programmatic semantics for natural language interfaces. In Proceedings of the ACM Conference on Human Factors in Computing. 1597–1600.
MAC ́IAS, J. A. AND PATERNO`, F. 2008. Customization of web applications through an intelligent environment exploiting logical interface descriptions. Interact. Computers. 20, 1, 29–47.
MACKAY, W. E. 1990. Patterns of sharing customizable software. In Proceedings of the ACM Conference on Computer-Supported Cooperative Work. 209–221.
MACLEAN, A., CARTER, K., LO ̈ VSTRAND, L., AND MORAN, T. 1990. User-tailorable systems: Pressing the issue with buttons. In Proceedings of the ACM Conference on Human Factors in Computing Systems. 175–182.
MANDELIN, D., XU, L., BODIK, R., AND KIMELMAN, D. 2005. Jungloid mining: Helping to navigate the API jungle. In ACM SIGPLAN Conference on Programming Language Design and Implementation. 48–61.
MARGOLIS, J. AND FISHER, A. 2003. Unlocking the Clubhouse, MIT Press, Cambridge, MA. MARTINSON, A. M. 2005. Playing with technology: Designing gender sensitive games to close the gender gap.
Working Paper SLISWP-03-05, School of Library and Information Science, Indiana University.
MATWIN, S. AND PIETRZYKOWSKI, T. 1985. Prograph: A preliminary report. Comput. Lang. 10, 2, 91–126.
MCDANIEL, R., AND MYERS, B. 1999. Getting more out of programming-by-demonstration. In Proceedings of the ACM Conference on Human Factors in Computing Systems. 442–449.
MEHANDJIEV, N., SUTCLIFFE, A., AND LEE, D. 2006. Organizational view of end-user development. In End-User Development, Springer, 371–399.
MILLER, R. AND MYERS, B. A. 2001a. Outlier finding: Focusing user attention on possible errors. In Proceedings of the ACM Symposium on User Interface Software and Technology. 81–90.
MILLER, R. AND MYERS, B. A. 2001b. Interactive simultaneous editing of multiple text regions. In Proceedings of the USENIX Annual Technical Conference. 161–174.
MILLER, R. AND MYERS, B. 2002. LAPIS: Smart editing with text structure. In Proceedings of the ACM Confer- ence on Human Factor in Computing Systems. 496–497.
MITTERMEIR, R. AND CLERMONT, M. 2002. Finding high-level structures in spreadsheet programs. In Proceedings of the Working Conference on Reverse Engineering. 221–232.
MODUGNO, F. AND MYERS, B. 1994. Pursuit: Graphically representing programs in a demonstrational visual shell. In Proceedings of the ACM Conference on Human Factors in Computing Systems. 455–456.
MØRCH, A. AND MEHANDJIEV, N. D. 2000. Tailoring as collaboration: The mediating role of multiple represen- tations and application units. Comput. Supp. Coop. Work 9, 1, 75–100.
MYERS, B., PARK, S., NAKANO, Y., MUELLER, G., AND KO. A. J. 2008. How designers design and program interactive behaviors. In Proceedings of the IEEE Symposium on Visual Languages and Human-Centric Computing. 177–184.
MYERS, B. A., WEITZMAN, D., KO. A. J., AND CHAU, D. H. 2006. Answering why and why not questions in user interfaces. In Proceedings of the ACM Conference on Human Factors in Computing Systems. 397–406. NARDI, B. A. 1993. A Small Matter of Programming: Perspectives on End User Computing. The MIT Press.
NEWMAN, M.W., LIN, J., HONG, J. I., AND LANDAY, J. A. 2003. DENIM: An informal web site design tool inspired by observations of practice. Human-Comput. Interact. 18, 3, 259–324.
NICHOLS, J., AND LAU, T. 2008. Mobilization by demonstration: using traces to re-author existing web sites. In Proceedings of the Symposium on Intelligent User Interfaces. 149–158.
NIESS, M., SADRI, P., AND LEE, K. 2007. Dynamic spreadsheets as learning technology tools: Developing teach- ers’ technology pedagogical content knowledge (TPCK). American Educational Research Association.
NKWOCHA, F. AND ELBAUM, F. 2005. Fault patterns in Matlab. In Proceedings of the International Conference on Software Engineering, 1st Workshop on End-user Software Engineering. 1–4.
OKADA, E. M. 2005. Justification effects on consumer choice of hedonic and utilitarian goods. J. Market. Res. 62, 43–53.
ONOMA, K., TSAI W-T, POONAWALA, M., AND SUGANUMA, H. 1988. Regression testing in an industrial environment. Comm. ACM. 41, 5, 81–86.
ORRICK, E. 2006. Electronic medical records–Building encounter forms. In Proceedings of the 2nd Workshop on End-User Software Engineering, in conjunction with the ACM Conference on Human Factors in Computing.
PANKO, R. 1995. Finding spreadsheet errors: Most spreadsheet models have design flaws that may lead to long-term miscalculation. Information Week, May, 100.
PANKO, R. 1998. What we know about spreadsheet errors. J. End User Comput. 2, 15–21. PANKO, R. 2000. Spreadsheet errors: What we know. What we think we can do. In Proceedings of the Spread-
sheet Risk Symposium. PETRE, M. AND BLACKWELL, A. F. 2007. Children as unwitting end-user programmers. In Proceedings of the
IEEE Symposium on Visual Languages and Human-Centric Computing. 239–242. PHALGUNE, A., KISSINGER, C., BURNETT, M., COOK, C., BECKWITH, L., AND RUTHRUFF, J. R. 2005. Garbage in, garbage out? An empirical look at oracle mistakes by end-user programmers. In Proceedings of the IEEE
Symposium on Visual Languages and Human-Centric Computing. 45–52. PIPEK, V. AND KAHLER, H. 2006. Supporting collaborative tailoring. In End-User Development, Springer,
315–345. 
POWELL, S. G. AND BAKER, K. R. 2004. The Art of Modeling with Spreadsheets: Management Science, Spreadsheet Engineering, and Modeling Craft. Wiley. 
PRABHAKARARAO, S., COOK, C., RUTHRUFF, J., CRESWICK, E., MAIN, M., DURHAM, M., AND BURNETT, M. 2003. Strate-
gies and behaviors of end-user programmers with interactive fault localization. In Proceedings of the
IEEE Symposium on Human-Centric Computing Languages and Environments. 15–22. RAKIC, M. AND MEDVIDOVIC, N. 2001. Increasing the confidence in off-the-shelf components: A software
connector-based approach. ACM SIGSOFT Soft. Eng. Notes. 26, 3, 11–18. RAVICHANDRAN, T. AND ROTHENBERGER, M. 2003. Software reuse strategies and component markets. Comm.
ACM 46, 8, 109–114. RAZ, O., KOOPMAN, P., AND SHAW, M. 2002. Semantic anomaly detection in online data sources. In Proceedings
of the International Conference on Software Engineering. 302–312. REPENNING, A. AND IOANNIDOU, A. 1997. Behavior processors: Layers between end users and Java virtual
machine. In Proceedings of the IEEE Symposium on Visual Languages. REPENNING, A. AND PERRONE, C. 2000. Programming by analogous examples. Comm. ACM 43, 3, 90–97. REPENNING, A. AND SULLIVAN, J. 2003. The pragmatic web: Agent-based multimodal web interaction with no
browser in sight. In Proceedings of the International Conference on Human-Computer Interaction.
RUTHRUFF, J. R., PHALGUNE, A., BECKWITH, L., BURNETT, M., AND COOK, C. 2004. Rewarding “good” behavior: End-user debugging and rewards. In Proceedings of the IEEE Symposium on Visual Languages and Human-Centered Computing. 115–122.
RUTHRUFF, J., PRABHAKARARAO, S., REICHWEIN, J., COOK, C., CRESWICK, E., AND BURNETT, M. 2005. Interactive, visual fault localization support for end-user programmers. J. Vis. Lang. Comput. 16, 1-2, 3–40.
SAJANIEMI, J. 2000. Modeling spreadsheet audit: A rigorous approach to automatic visualization. J. Vis. Lang. Comput. 11, 1, 49–82.
SCAFFIDI, C. 2007. Unsupervised inference of data formats in human-readable notation. In Proceedings of 9th International Conference on Enterprise Integration Systems. (HCI Volume), 236–241.
SCAFFIDI, C., KO, A. J., MYERS, B., AND SHAW, M. 2006. Dimensions characterizing programming feature usage by information workers. In Proceedings of the IEEE Symposium on Visual Languages and Human-Centric Computing. 59–62.
SCAFFIDI, C., MYERS, B., AND SHAW, M. 2007. Trial by water: Creating Hurricane Katrina “person locator” web sites. In Leadership at a Distance: Research in Technologically-Supported Work, Lawrence Erlbaum.
SCAFFIDI, C., MYERS, B. A., AND SHAW, M. 2008. Topes: Reusable abstractions for validating data. In Proceedings of the International Conference on Software Engineering. 1–10.
SCAFFIDI, C., SHAW, M., AND MYERS, B. A. 2005. Estimating the numbers of end users and end user programmers. In Proceedings of the IEEE Symposium on Visual Languages and Human-Centric Computing. 207–214. SEGAL, J. 2005. When software engineers met research scientists: A case study. Empir. Softw. Eng. 10, 517–
536. SEGAL, J. 2007. Some problems of professional end user developers. In Proceedings of the IEEE Symposium
on Visual Languages and Human-Centric Computing. 111–118. SHAW, M. 1995. Architectural issues in software reuse: It’s not just the functionality, it’s the packaging. In
Proceedings of the Symposium on Software Reusability. 3–6. SHAW, M. 2004. Avoiding costly errors in your spreadsheets. Contractor’s Manage. Rep. 11, 2–4. SMITH, D., CYPHER, A., AND SPOHRER, J. 1994. KidSim: Programming agents without a programming language.
Comm. ACM 37, 7, 54–67. SMITH, D., CYPHER, A., AND TESLER, L. 2000. Programming by example: Novice programming comes of age.
Comm. ACM 43, 3, 75–81. STEVENS, G., QUAISSER, G., AND KLANN, M. 2006. Breaking it up: An industrial case study of component-based
tailorable software design. In End-User Development, Springer, 269–294. STYLOS, J. AND MYERS, B. A. 2006. Mica: A web-search tool for finding API components and examples. In
Proceedings of the IEEE Symposium on Visual Languages and Human-Centric Computing. 195–202. STYLOS, J., MYERS, B. A., AND FAULRING A. 2004. Citrine: Providing intelligent copy-and-paste. In Proceedings
of the ACM Symposium on User Interface Software and Technology. 185–188. SUBRAHMANIYAN, N., KISSINGER, C., RECTOR, K., INMAN, D., KAPLAN, J., BECKWITH, L., AND BURNETT, M. M. 2007. Explaining debugging strategies to end-user programmers. In Proceedings of the IEEE Symposium on
Visual Languages and Human-Centric Computing. 127–134. SUBRAHMANIYAN, N., BECKWITH, L., GRIGOREANU, V., BURNETT, M., WIEDENBECK, S., NARAYANAN, V., BUCHT, K.,
DRUMMOND, R., AND FERN, X. 2008. Testing vs. code inspection vs. what else?: male and female end users’ debugging strategies. In Proceedings of the ACM Conference on Human Factors in Computing Systems. 617–626.
SUTCLIFFE, A. AND MEHANDJIEV, N. 2004. End-user development. Comm. ACM 47, 9, 31–32. SUTCLIFFE, A. G. 2002. The Domain Theory: Patterns for Knowledge and Software Reuse. Lawrence Erlbaum
Associates, Mahwah NJ. TALBOT, J., LEE, B., KAPOOR, A., AND TAN, D. S. 2009. EnsembleMatrix: Interactive visualization to support
machine learning with multiple classifiers. In Proceedings of the ACM Conference on Human Factors in
Computing Systems. 1283–1292. TASSEY, G. 2002. The economic impacts of inadequate infrastructure for software testing. RTI Project Number
7007.011, National Institute of Standards and Technology. TEASLEY, B. AND LEVENTHAL, L. 1994. Why software testing is sometimes ineffective: Two applied studies of
positive test strategy. J. Appl. Psych. 79, 1, 142–155. TEXIER, G., AND GUITTET, L. 1999. User defined objects are first class citizens. In Proceedings of the International
Conference on Computer-Aided Design of User Interfaces. 231–244.
TIP, F. 1995. A survey of program slicing techniques. J. Prog. Lang. 3, 3, 121–189. TOOMIM, M., DRUCKER, S. M., DONTCHEVA, M., RAHIMI, A., THOMSON, B., AND LANDAY, J. A. 2009. Attaching UI enhancements to websites with end users. In Proceedings of the ACM Conference on Human Factors in
Computing Systems. 1859–1868.
TOOMIM, M., BEGEL, A., AND GRAHAM, S. L. 2004. Managing duplicated code with linked editing. In Proceedings of the IEEE Symposium on Visual Languages and Human Centric Computing. 173–180.
TRIGG, R. H. AND BØDKER, S. 1994. From implementation to design: Tailoring and the emergence of system- atization in CSCW. In Proceedings of the ACM Conference on Computer Supported Cooperative Work. 45–54.
UMARJI, M., POHL, M., SEAMAN, C., KORU, A. G., AND LIU, H. 2008. Teaching software engineering to end-users. In Proceedings of the International Workshop on End-User Software Engineering. 40–42.
VAN, DEN HEUVEL-PANHEIZEN, M. 1999. Girls’ and boys’ problems: Gender differences in solving problems in pri- mary school mathematics in the Netherlands. In Learning and Teaching Mathematics: An International Perspective, Psychology Press, UK, 223–253.
WALPOLE, R. AND BURNETT, M. 1997. Supporting reuse of evolving visual code. In Proceedings of the IEEE Symposium on Visual Languages. 68–75.
WHITE, L. J. 1987. Software testing and verification. In Advances in Computers. Academic Press, Orlando, FL, 335–390.
WHITTAKER, D. 1999. Spreadsheet errors and techniques for finding them. Manage. Account. 77, 9, 50–51. WIEDENBECK, S. 2005. Facilitators and inhibitors of end-user development by teachers in a school environment.
IEEE Symposium on Visual Languages and Human-Centric Computing. 215–222. WIEDENBECK, S. AND ENGEBRETSON, A. 2004. Comprehension strategies of end-user programmers in an event- driven application. In Proceedings of the IEEE Symposium on Visual Languages and Human Centric
Computing. 207–214. WILCOX, E., ATWOOD, J., BURNETT, M., CADIZ, J., AND COOK, C. 1997. Does continuous visual feedback aid
debugging in direct-manipulation programming systems? In Proceedings of the ACM Conference on
Human Factors in Computing Systems. 258–265. WILSON, A., BURNETT, M., BECKWITH, L., GRANATIR, O., CASBURN, L., COOK C., DURHAM, M., AND ROTHERMEL, G.
2003. Harnessing curiosity to increase correctness in end-user programming. In Proceedings of the ACM
Conference on Human Factors in Computing Systems. 305–312. WOLBER, D., SU, Y., AND CHIANG, Y. T. 2002. Designing dynamic web pages and persistence in the WYSIWYG
interface. In Proceedings of the International Conference on Intelligent User Interfaces. 228–229. WON, M., STIEMERLING, O., AND WULF, V. 2006. Component-based approaches to tailorable systems. In End-User
Development, Springer, 115–141. WONG, J. AND HONG, J. I. 2007. Making mashups with Marmite: Re-purposing web content through end-user
programming. In Proceedings of ACM Conference on Human Factors in Computing Systems. WULF, V. 1999. “Let’s see your search-tool!”—Collaborative use of tailored artifacts in groupware. In Proceed-
ings of the ACM SIGGROUP Conference on Supporting Group Work. 50–59. WULF, V. 2000. Exploration environments: Supporting users to learn groupware functions. Interact. Comput-
ers 13, 265–299. WULF, V. PATERNO, F., AND LIEBERMAN, H. Eds. 2006, End User Development. Kluwer Academic Publishers. WULF, V., PIPEK, V., AND WON, M. 2008. Component-based tailorability: Enabling highly flexible software
applications. Int. J. Human-Computer Stud. 66, 1–22. YE, Y. AND FISCHER, G. 2005. Reuse-conducive development environments. Int. J. Automat. Softw. Eng. 12, 2,
199–235.
 



